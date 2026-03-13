import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';

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

  async create(payload: CreateAgentDto): Promise<AgentEntity> {
    const entity = this.repository.create(payload);
    return this.repository.save(entity);
  }
}
