import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainRuleEntity } from './domain-rule.entity';
import { CreateDomainRuleDto } from './dto/create-domain-rule.dto';
import { UpdateDomainRuleDto } from './dto/update-domain-rule.dto';

@Injectable()
export class DomainRulesService {
  constructor(
    @InjectRepository(DomainRuleEntity)
    private readonly repository: Repository<DomainRuleEntity>,
  ) {}

  async listAll(): Promise<DomainRuleEntity[]> {
    return this.repository.find({
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

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

  async update(domainId: string, ruleId: string, payload: UpdateDomainRuleDto): Promise<DomainRuleEntity> {
    const entity = await this.repository.findOne({ where: { domainId, ruleId } });
    if (!entity) {
      throw new NotFoundException(`Rule '${ruleId}' not found`);
    }
    Object.assign(entity, payload);
    return this.repository.save(entity);
  }

  async remove(domainId: string, ruleId: string): Promise<void> {
    const result = await this.repository.delete({ domainId, ruleId });
    if (!result.affected) {
      throw new NotFoundException(`Rule '${ruleId}' not found`);
    }
  }
}
