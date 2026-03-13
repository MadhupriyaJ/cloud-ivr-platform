import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainRuleEntity } from './domain-rule.entity';
import { CreateDomainRuleDto } from './dto/create-domain-rule.dto';

@Injectable()
export class DomainRulesService {
  constructor(
    @InjectRepository(DomainRuleEntity)
    private readonly repository: Repository<DomainRuleEntity>,
  ) {}

  async listByDomain(domainId: string): Promise<DomainRuleEntity[]> {
    return this.repository.find({
      where: { domainId },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(domainId: string, payload: CreateDomainRuleDto): Promise<DomainRuleEntity> {
    const entity = this.repository.create({ ...payload, domainId });
    return this.repository.save(entity);
  }
}
