/**
 * Exercises the escalation lifecycle against in-memory repositories:
 * routing, capacity, queue draining, dedupe and release-on-close.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Tests run against the compiled output; run `npm run build` first.
const DIST = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href;
const { AgentsService } = await import(`${DIST}/modules/agents/agents.service.js`);
const { EscalationsService } = await import(`${DIST}/modules/escalations/escalations.service.js`);
const { EscalationEventsService } = await import(
  `${DIST}/modules/escalations/escalation-events.service.js`
);

/** Minimal TypeORM-ish repository over a Map, enough for these services. */
function fakeRepo(idField) {
  const rows = new Map();

  const matches = (row, where) =>
    Object.entries(where || {}).every(([key, expected]) => {
      // FindOperator In(...) exposes its values on _value.
      if (expected && typeof expected === 'object' && Array.isArray(expected._value)) {
        return expected._value.includes(row[key]);
      }
      return row[key] === expected;
    });

  return {
    rows,
    create: (data) => ({ ...data }),
    save: async (entity) => {
      if (!entity[idField]) entity[idField] = randomUUID();
      rows.set(entity[idField], entity);
      return entity;
    },
    findOne: async ({ where }) => {
      const found = [...rows.values()].filter((row) => matches(row, where));
      return found[0] ?? null;
    },
    find: async ({ where, take } = {}) => {
      const found = [...rows.values()].filter((row) => matches(row, where));
      return take ? found.slice(0, take) : found;
    },
    update: async (where, changes) => {
      for (const row of rows.values()) {
        if (matches(row, where)) Object.assign(row, changes);
      }
    },
    delete: async () => undefined,
  };
}

const agentRepo = fakeRepo('agentId');
const escalationRepo = fakeRepo('escalationId');
const agentsService = new AgentsService(agentRepo);
const events = new EscalationEventsService();

const conversations = new Map();
const conversationsService = {
  findById: async (id) => conversations.get(id) ?? null,
  markEscalated: async (id) => conversations.get(id),
  assignAgent: async (id, agentId) => {
    const c = conversations.get(id);
    if (c) c.assignedAgentId = agentId;
  },
  closeConversation: async (id) => conversations.get(id),
  listMessages: async () => [
    { speakerType: 'customer', messageType: 'text', messageText: 'I need help with my bill' },
    { speakerType: 'assistant', messageType: 'text', messageText: 'Let me check that for you' },
  ],
};

const service = new EscalationsService(escalationRepo, agentsService, conversationsService, events);
service.onModuleInit();

const published = [];
for (const type of [
  'escalation.created',
  'escalation.assigned',
  'escalation.accepted',
  'escalation.closed',
  'escalation.requeued',
]) {
  events.on(type, (event) => published.push(event.type));
}

/* Seed: one billing agent (capacity 1), one offline generalist. */
const billing = await agentsService.create({
  name: 'Bilal',
  email: 'bilal@example.test',
  skillGroup: 'billing',
  availabilityStatus: 'available',
  maxConcurrent: 1,
  isActive: true,
});
const generalist = await agentsService.create({
  name: 'Gita',
  email: 'gita@example.test',
  skillGroup: 'general',
  availabilityStatus: 'offline',
  maxConcurrent: 1,
  isActive: true,
});

const convA = randomUUID();
const convB = randomUUID();
conversations.set(convA, { conversationId: convA, domainId: randomUUID(), customerIdentifier: '+15550001111' });
conversations.set(convB, { conversationId: convB, domainId: randomUUID(), customerIdentifier: '+15550002222' });

/* 1. First escalation routes to the available, skill-matched agent. */
let first = await service.create({
  conversationId: convA,
  escalationReason: 'Billing dispute',
  skillGroup: 'billing',
  priority: 'high',
});
assert.equal(first.status, 'assigned');
assert.equal(first.assignedAgentId, billing.agentId);
assert.equal((await agentsService.getById(billing.agentId)).activeEscalations, 1);
assert.equal((await agentsService.getById(billing.agentId)).availabilityStatus, 'busy', 'agent at cap goes busy');
assert.ok(first.contextSummary?.includes('I need help with my bill'), 'transcript handed to agent');
console.log('OK routes to the matching available agent and claims capacity');

/* 2. Same conversation escalating again reuses the open escalation. */
const duplicate = await service.create({ conversationId: convA, escalationReason: 'asked again' });
assert.equal(duplicate.escalationId, first.escalationId, 'no duplicate queue entry per conversation');
console.log('OK duplicate escalation on one conversation is deduped');

/* 3. Nobody free -> queued. */
let second = await service.create({
  conversationId: convB,
  escalationReason: 'Caller asked for a human',
  priority: 'urgent',
});
assert.equal(second.status, 'queued');
assert.equal(second.assignedAgentId, null);
console.log('OK escalation queues when every agent is at capacity');

/* 4. Accept moves it to accepted. */
first = await service.accept(first.escalationId);
assert.equal(first.status, 'accepted');
assert.ok(first.acceptedAt instanceof Date);
console.log('OK accept transitions to accepted');

/* 5. Closing frees the agent AND drains the queue automatically. */
first = await service.close(first.escalationId, { resolutionNotes: 'Refund issued' });
assert.equal(first.status, 'resolved');
assert.equal(first.resolutionNotes, 'Refund issued');
await new Promise((resolve) => setImmediate(resolve)); // dispatch is fire-and-forget

second = await service.getById(second.escalationId);
assert.equal(second.status, 'assigned', 'queued work is dispatched when capacity frees up');
assert.equal(second.assignedAgentId, billing.agentId);
console.log('OK closing releases the agent and drains the queue');

/* 6. Presence change also drains the queue. */
const third = await service.create({ conversationId: randomUUID(), escalationReason: 'Third caller' });
assert.equal(third.status, 'queued');
const revived = await agentsService.setAvailability(generalist.agentId, 'available');
events.publish({
  type: 'agent.presence',
  agent: {
    agentId: revived.agentId,
    name: revived.name,
    availabilityStatus: revived.availabilityStatus,
  },
});
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal((await service.getById(third.escalationId)).assignedAgentId, generalist.agentId);
console.log('OK an agent going available picks up queued work');

/* 7. Requeue releases the agent again. */
const requeued = await service.requeue(third.escalationId, 'cannot take it');
assert.equal(requeued.status, 'queued');
assert.equal(requeued.assignedAgentId, null);
console.log('OK requeue unassigns and releases the agent');

/* 8. Stats reflect the work done. */
const stats = await service.stats();
assert.equal(typeof stats.avgWaitSeconds, 'number');
assert.ok(stats.open >= 1);
assert.equal(stats.resolvedToday, 1);
console.log('OK queue statistics');

/* 9. Every lifecycle event reached subscribers. */
for (const expected of [
  'escalation.created',
  'escalation.assigned',
  'escalation.accepted',
  'escalation.closed',
  'escalation.requeued',
]) {
  assert.ok(published.includes(expected), `missing event ${expected}`);
}
console.log('OK lifecycle events published to the agent desk feed');

console.log('\nAll escalation lifecycle checks passed.');
