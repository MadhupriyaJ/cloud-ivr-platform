import { DomainRulesService } from './domain-rules.service';
import { CreateDomainRuleDto } from './dto/create-domain-rule.dto';
export declare class DomainRulesController {
    private readonly service;
    constructor(service: DomainRulesService);
    list(domainId: string): Promise<{
        items: import("./domain-rule.entity").DomainRuleEntity[];
    }>;
    create(domainId: string, payload: CreateDomainRuleDto): Promise<import("./domain-rule.entity").DomainRuleEntity>;
}
