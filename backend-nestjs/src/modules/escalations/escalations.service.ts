import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscalationEntity } from './escalation.entity';
import { CreateEscalationDto } from './dto/create-escalation.dto';

@Injectable()
export class EscalationsService {
  constructor(
    @InjectRepository(EscalationEntity)
    private readonly repository: Repository<EscalationEntity>,
  ) {}

  async list(): Promise<EscalationEntity[]> {
    return this.repository.find({
      order: { escalatedAt: 'DESC' },
      take: 100,
    });
  }

  async create(payload: CreateEscalationDto): Promise<EscalationEntity> {
    const entity = this.repository.create({
      ...payload,
      escalatedAt: new Date(),
      assignedAgentId: payload.assignedAgentId ?? null,
    });
    return this.repository.save(entity);
  }
}
