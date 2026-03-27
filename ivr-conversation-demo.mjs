#!/usr/bin/env node
/**
 * IVR Conversation Demo - Automated
 * 
 * Run: node ivr-conversation-demo.mjs
 * 
 * This script runs complete conversations across all 3 domains automatically.
 * It shows exactly how a caller would interact with each IVR system.
 * No user input required — it plays through pre-defined scenarios.
 */

const API_BASE = process.env.API_BASE || 'http://localhost:8010/api';

// ─── Colors ───
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';

// ─── API Helper ───
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printDivider(char = '─', len = 60) {
  console.log(`  ${DIM}${char.repeat(len)}${RESET}`);
}

// ─── Conversation Scenarios ───
const SCENARIOS = [
  {
    name: '🏥 Hospital - Book Appointment',
    domainCode: 'hospital-management',
    description: 'A patient calls to book a Cardiology appointment for April 1st.',
    inputs: [
      { text: 'appointment', description: 'Caller wants to book an appointment' },
      { text: 'Cardiology', description: 'Caller selects Cardiology department' },
      { text: '2026-04-01', description: 'Caller provides preferred date' },
    ],
  },
  {
    name: '🏥 Hospital - Check Lab Reports',
    domainCode: 'hospital-management',
    description: 'A patient calls to check their lab test results.',
    inputs: [
      { text: 'lab_reports', description: 'Caller wants lab reports' },
      { text: 'PAT-001', description: 'Caller provides patient ID' },
    ],
  },
  {
    name: '🏦 Banking - Check Balance',
    domainCode: 'banking',
    description: 'A customer calls to check their savings account balance.',
    inputs: [
      { text: 'balance', description: 'Caller wants to check balance' },
      { text: '1234567890', description: 'Caller provides account number' },
    ],
  },
  {
    name: '🏦 Banking - Fund Transfer',
    domainCode: 'banking',
    description: 'A customer calls to transfer money to another account.',
    inputs: [
      { text: 'transfer', description: 'Caller wants to transfer funds' },
      { text: '5000', description: 'Caller specifies amount' },
      { text: '9876543210', description: 'Caller provides beneficiary account' },
    ],
  },
  {
    name: '🛒 E-Commerce - Order Status',
    domainCode: 'ecommerce',
    description: 'A customer calls to check the status of their order.',
    inputs: [
      { text: 'order_status', description: 'Caller wants order status' },
      { text: 'ORD-2026-001', description: 'Caller provides order ID' },
    ],
  },
  {
    name: '🛒 E-Commerce - Return Request',
    domainCode: 'ecommerce',
    description: 'A customer calls to initiate a product return.',
    inputs: [
      { text: 'return', description: 'Caller wants to return a product' },
      { text: 'ORD-2026-001', description: 'Caller provides order ID' },
      { text: 'Wrong size', description: 'Caller provides return reason' },
    ],
  },
];

async function runScenario(scenario, index) {
  console.log('');
  console.log(`  ${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${RESET}`);
  console.log(`  ${BOLD}${MAGENTA}  SCENARIO ${index + 1}: ${scenario.name}${RESET}`);
  console.log(`  ${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${RESET}`);
  console.log(`  ${DIM}${scenario.description}${RESET}`);
  console.log(`  ${DIM}Domain: ${scenario.domainCode}${RESET}`);
  printDivider();

  // Step 1: Start session
  console.log(`\n  ${YELLOW}📞 Incoming call...${RESET}`);
  await sleep(500);

  let sessionId;
  try {
    const result = await api('/ivr-engine/session/start', {
      method: 'POST',
      body: JSON.stringify({ domainCode: scenario.domainCode }),
    });
    sessionId = result.sessionId;

    console.log(`  ${DIM}Session: ${sessionId}${RESET}`);
    console.log('');
    console.log(`  ${GREEN}${BOLD}🤖 IVR:${RESET} ${GREEN}${result.step.promptText}${RESET}`);
    console.log(`  ${DIM}     [node: ${result.step.nodeCode} | type: ${result.step.nodeType}]${RESET}`);
  } catch (e) {
    console.log(`  ${RED}✗ Failed to start: ${e.message}${RESET}`);
    return { success: false, error: e.message };
  }

  await sleep(800);

  // Step 2+: Process each input
  let lastVariables = {};
  let lastStatus = 'active';

  for (let i = 0; i < scenario.inputs.length; i++) {
    const input = scenario.inputs[i];
    
    console.log('');
    console.log(`  ${DIM}  ↳ ${input.description}${RESET}`);
    console.log(`  ${BLUE}${BOLD}👤 Caller:${RESET} ${CYAN}"${input.text}"${RESET}`);
    
    await sleep(600);

    try {
      const result = await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}/input`, {
        method: 'POST',
        body: JSON.stringify({ userInput: input.text }),
      });

      lastStatus = result.status;
      lastVariables = result.variables || {};

      console.log(`  ${GREEN}${BOLD}🤖 IVR:${RESET} ${GREEN}${result.step.promptText}${RESET}`);
      console.log(`  ${DIM}     [node: ${result.step.nodeCode} | type: ${result.step.nodeType}]${RESET}`);

      // Show collected variables
      const filtered = Object.entries(lastVariables).filter(([k]) => !k.startsWith('_'));
      if (filtered.length > 0 && i === scenario.inputs.length - 1) {
        console.log(`  ${DIM}     📋 Variables: ${filtered.map(([k,v]) => `${k}=${v}`).join(', ')}${RESET}`);
      }

      if (result.status === 'completed') {
        console.log(`\n  ${YELLOW}📞 Call completed.${RESET}`);
        break;
      }
    } catch (e) {
      console.log(`  ${RED}✗ Error: ${e.message}${RESET}`);
      break;
    }

    await sleep(500);
  }

  // End session
  if (lastStatus === 'active') {
    try {
      await api(`/ivr-engine/session/${encodeURIComponent(sessionId)}/end`, { method: 'POST' });
      console.log(`\n  ${YELLOW}📞 Caller hangs up.${RESET}`);
    } catch (_) {}
  }

  // Summary
  printDivider();
  const filtered = Object.entries(lastVariables).filter(([k]) => !k.startsWith('_'));
  console.log(`  ${BOLD}Summary:${RESET}`);
  console.log(`    ${DIM}Domain:${RESET}    ${scenario.domainCode}`);
  console.log(`    ${DIM}Steps:${RESET}     ${scenario.inputs.length + 1} (welcome + ${scenario.inputs.length} inputs)`);
  console.log(`    ${DIM}Status:${RESET}    ${lastStatus}`);
  if (filtered.length > 0) {
    console.log(`    ${DIM}Collected:${RESET}`);
    for (const [k, v] of filtered) {
      console.log(`      ${YELLOW}${k}${RESET} = ${WHITE}${v}${RESET}`);
    }
  }
  console.log('');

  return { success: true, variables: lastVariables, status: lastStatus };
}

// ─── Main ───
async function main() {
  console.log('');
  console.log(`${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║       IVR CONVERSATION DEMO - Automated Scenarios       ║${RESET}`);
  console.log(`${BOLD}║       Generic IVR Engine v1.0 - All 3 Domains           ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}`);

  // Health check
  try {
    const health = await api('/ivr-engine/health');
    console.log(`\n  ${GREEN}✓ Engine connected${RESET} — ${health.engine.flows} flows, ${health.engine.nodes} nodes, ${health.engine.endpoints} endpoints`);
  } catch (e) {
    console.log(`\n  ${RED}✗ Cannot connect to IVR Engine at ${API_BASE}${RESET}`);
    console.log(`  ${RED}  Start the backend: cd backend-nestjs && PORT=8010 node dist/main.js${RESET}`);
    process.exit(1);
  }

  console.log(`\n  ${DIM}Running ${SCENARIOS.length} conversation scenarios...${RESET}`);

  const results = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const result = await runScenario(SCENARIOS[i], i);
    results.push({ ...result, name: SCENARIOS[i].name });
    await sleep(1000);
  }

  // Final report
  console.log('');
  console.log(`  ${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${RESET}`);
  console.log(`  ${BOLD}${MAGENTA}  FINAL REPORT${RESET}`);
  console.log(`  ${BOLD}${MAGENTA}═══════════════════════════════════════════════════════${RESET}`);
  console.log('');

  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.success) {
      console.log(`  ${GREEN}✓${RESET} ${r.name}`);
      passed++;
    } else {
      console.log(`  ${RED}✗${RESET} ${r.name} — ${r.error}`);
      failed++;
    }
  }

  console.log('');
  console.log(`  ${BOLD}Total: ${results.length} | Passed: ${GREEN}${passed}${RESET}${BOLD} | Failed: ${failed > 0 ? RED : GREEN}${failed}${RESET}`);
  console.log('');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
