import { Repository } from 'typeorm';
import { DomainRuleEntity } from './domain-rule.entity';
import { CreateDomainRuleDto } from './dto/create-domain-rule.dto';
import { UpdateDomainRuleDto } from './dto/update-domain-rule.dto';
export declare class DomainRulesService {
    private readonly repository;
    constructor(repository: Repository<DomainRuleEntity>);
    listByDomain(domainId: string): Promise<DomainRuleEntity[]>;
    create(domainId: string, payload: CreateDomainRuleDto): Promise<DomainRuleEntity>;
    update(domainId: string, ruleId: string, payload: UpdateDomainRuleDto): Promise<DomainRuleEntity>;
    remove(domainId: string, ruleId: string): Promise<void>;
}
