import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEntity } from './domain.entity';
import { CreateDomainDto } from './dto/create-domain.dto';

/** Tables holding business history; any row here blocks a domain delete. */
const DOMAIN_HISTORY_TABLES: [table: string, label: string][] = [
  ['Conversations', 'conversation(s)'],
  ['CallSessions', 'call(s)'],
  ['Escalations', 'escalation(s)'],
  ['EscalationRecords', 'escalation record(s)'],
  ['Departments', 'department(s)'],
  ['Doctors', 'doctor(s)'],
  ['PhoneNumbers', 'phone number(s)'],
];

/** Per-domain configuration and logs, deleted along with the domain. */
const DOMAIN_CONFIG_TABLES = [
  'IvrFlows',
  'DomainApiEndpoints',
  'DomainAdapterConfigs',
  'DomainIntents',
  'DomainRules',
  'PromptTemplates',
  'ToolDefinitions',
  'DomainFields',
  'EscalationPolicies',
  'IntentClassificationCache',
  'SessionAnalytics',
  'ToolExecutionLogs',
  'ErrorLogs',
];

@Injectable()
export class DomainService {
  constructor(
    @InjectRepository(DomainEntity)
    private readonly domainRepository: Repository<DomainEntity>,
  ) {}

  async list(): Promise<DomainEntity[]> {
    return this.domainRepository.find({
      order: {
        updatedAt: 'DESC',
      },
    });
  }

  async getByCode(domainCode: string): Promise<DomainEntity> {
    const domain = await this.domainRepository.findOne({
      where: {
        domainCode,
      },
    });

    if (!domain) {
      throw new NotFoundException(`Domain '${domainCode}' not found.`);
    }

    return domain;
  }

  async getById(domainId: string): Promise<DomainEntity> {
    const domain = await this.domainRepository.findOne({
      where: {
        domainId,
      },
    });

    if (!domain) {
      throw new NotFoundException(`Domain '${domainId}' not found.`);
    }

    return domain;
  }

  async create(payload: CreateDomainDto): Promise<DomainEntity> {
    const entity = this.domainRepository.create(payload);
    return this.domainRepository.save(entity);
  }

  async updateByCode(domainCode: string, payload: CreateDomainDto): Promise<DomainEntity> {
    const current = await this.getByCode(domainCode);
    const next = this.domainRepository.merge(current, payload, {
      domainCode: payload.domainCode || domainCode,
    });
    return this.domainRepository.save(next);
  }

  /**
   * Delete a domain together with its configuration (intents, rules, prompts,
   * tools, IVR flows, API endpoints, logs).
   *
   * A domain that already carries business history — conversations, calls,
   * escalations, hospital departments/doctors, mapped phone numbers — is not
   * deleted: that would destroy records the customer needs. The caller gets a
   * 409 and should deactivate the domain instead.
   */
  async deleteByCode(domainCode: string): Promise<void> {
    const current = await this.getByCode(domainCode);
    const domainId = current.domainId;

    await this.domainRepository.manager.transaction(async (manager) => {
      const existing = new Set<string>(
        (await manager.query(`SELECT name FROM sys.tables`)).map((row: { name: string }) => row.name),
      );
      const has = (table: string) => existing.has(table);

      const blockers: string[] = [];
      for (const [table, label] of DOMAIN_HISTORY_TABLES) {
        if (!has(table)) continue;
        const [{ total }] = await manager.query(
          `SELECT COUNT(*) AS total FROM ${table} WHERE DomainId = @0`,
          [domainId],
        );
        if (Number(total) > 0) blockers.push(`${total} ${label}`);
      }
      if (blockers.length) {
        throw new ConflictException(
          `Domain '${domainCode}' has ${blockers.join(', ')}. ` +
            'Deleting it would erase that history; deactivate the domain instead.',
        );
      }

      // IVR flow children have no foreign keys, so remove them explicitly.
      if (has('IvrNodeActions') && has('IvrFlowNodes') && has('IvrFlows')) {
        await manager.query(
          `DELETE a FROM IvrNodeActions a
             JOIN IvrFlowNodes n ON n.NodeId = a.NodeId
             JOIN IvrFlows f ON f.FlowId = n.FlowId
           WHERE f.DomainId = @0`,
          [domainId],
        );
      }
      if (has('IvrFlowNodes') && has('IvrFlows')) {
        await manager.query(
          `DELETE n FROM IvrFlowNodes n JOIN IvrFlows f ON f.FlowId = n.FlowId WHERE f.DomainId = @0`,
          [domainId],
        );
      }
      for (const table of DOMAIN_CONFIG_TABLES) {
        if (has(table)) {
          await manager.query(`DELETE FROM ${table} WHERE DomainId = @0`, [domainId]);
        }
      }

      await manager.query(`DELETE FROM Domains WHERE DomainId = @0`, [domainId]);
    });
  }
}
