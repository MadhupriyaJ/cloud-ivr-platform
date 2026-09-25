import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AgentAvailability, AgentEntity } from './agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly repository: Repository<AgentEntity>,
  ) {}

  async list(): Promise<AgentEntity[]> {
    return this.repository.find({
      order: { availabilityStatus: 'ASC', name: 'ASC' },
    });
  }

  async getById(agentId: string): Promise<AgentEntity> {
    const agent = await this.repository.findOne({ where: { agentId } });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }
    return agent;
  }

  async create(payload: CreateAgentDto): Promise<AgentEntity> {
    const entity = this.repository.create({
      ...payload,
      activeEscalations: 0,
      maxConcurrent: payload.maxConcurrent ?? 1,
    });
    return this.repository.save(entity);
  }

  async update(agentId: string, payload: UpdateAgentDto): Promise<AgentEntity> {
    const agent = await this.getById(agentId);
    Object.assign(agent, payload);
    return this.repository.save(agent);
  }

  async setAvailability(agentId: string, availabilityStatus: AgentAvailability): Promise<AgentEntity> {
    const agent = await this.getById(agentId);
    agent.availabilityStatus = availabilityStatus;
    agent.lastSeenAt = new Date();
    return this.repository.save(agent);
  }

  /**
   * Agents that can take another escalation right now, best candidate first.
   *
   * Ranking: agents whose skill group matches come first, then the least loaded,
   * then the longest idle — a simple longest-idle-agent distribution that keeps
   * work spread across the team instead of always hitting the first row.
   */
  async listAvailable(skillGroup?: string): Promise<AgentEntity[]> {
    const candidates = await this.repository.find({
      where: { isActive: true, availabilityStatus: In(['available', 'busy']) },
    });

    const normalizedSkill = skillGroup?.trim().toLowerCase();

    return candidates
      .filter((agent) => agent.activeEscalations < Math.max(1, agent.maxConcurrent))
      .filter((agent) => agent.availabilityStatus !== 'offline')
      .sort((a, b) => {
        if (normalizedSkill) {
          const aMatch = (a.skillGroup || '').trim().toLowerCase() === normalizedSkill ? 0 : 1;
          const bMatch = (b.skillGroup || '').trim().toLowerCase() === normalizedSkill ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        if (a.activeEscalations !== b.activeEscalations) {
          return a.activeEscalations - b.activeEscalations;
        }
        const aSeen = a.lastSeenAt ? a.lastSeenAt.getTime() : 0;
        const bSeen = b.lastSeenAt ? b.lastSeenAt.getTime() : 0;
        return aSeen - bSeen;
      });
  }

  /** Claim capacity on an agent; flips them to busy when they hit their cap. */
  async addLoad(agentId: string): Promise<AgentEntity> {
    const agent = await this.getById(agentId);
    agent.activeEscalations += 1;
    if (agent.activeEscalations >= Math.max(1, agent.maxConcurrent)) {
      agent.availabilityStatus = 'busy';
    }
    agent.lastSeenAt = new Date();
    return this.repository.save(agent);
  }

  /** Release capacity; returns the agent to available when they drop below cap. */
  async releaseLoad(agentId: string): Promise<AgentEntity> {
    const agent = await this.getById(agentId);
    agent.activeEscalations = Math.max(0, agent.activeEscalations - 1);
    if (
      agent.availabilityStatus === 'busy' &&
      agent.activeEscalations < Math.max(1, agent.maxConcurrent)
    ) {
      agent.availabilityStatus = 'available';
    }
    agent.lastSeenAt = new Date();
    return this.repository.save(agent);
  }
}
