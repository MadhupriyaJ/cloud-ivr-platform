import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainIntentEntity } from './domain-intent.entity';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';
import { UpdateDomainIntentDto } from './dto/update-domain-intent.dto';

@Injectable()
export class DomainIntentsService {
  constructor(
    @InjectRepository(DomainIntentEntity)
    private readonly repository: Repository<DomainIntentEntity>,
  ) {}

  async listByDomain(domainId: string): Promise<DomainIntentEntity[]> {
    return this.repository.find({
      where: { domainId },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(domainId: string, payload: CreateDomainIntentDto): Promise<DomainIntentEntity> {
    const entity = this.repository.create({ ...payload, domainId });
    return this.repository.save(entity);
  }

  async update(domainId: string, intentId: string, payload: UpdateDomainIntentDto): Promise<DomainIntentEntity> {
    const entity = await this.repository.findOne({ where: { domainId, intentId } });
    if (!entity) {
      throw new NotFoundException(`Intent '${intentId}' not found`);
    }
    Object.assign(entity, payload);
    return this.repository.save(entity);
  }

  async remove(domainId: string, intentId: string): Promise<void> {
    const result = await this.repository.delete({ domainId, intentId });
    if (!result.affected) {
      throw new NotFoundException(`Intent '${intentId}' not found`);
    }
  }
}
