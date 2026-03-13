import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainIntentEntity } from './domain-intent.entity';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';

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
}
