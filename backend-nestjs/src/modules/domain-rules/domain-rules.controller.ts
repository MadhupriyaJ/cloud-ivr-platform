import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DomainRulesService } from './domain-rules.service';
import { CreateDomainRuleDto } from './dto/create-domain-rule.dto';

@Controller('domains/:domainId/rules')
export class DomainRulesController {
  constructor(private readonly service: DomainRulesService) {}

  @Get()
  async list(@Param('domainId') domainId: string) {
    return {
      items: await this.service.listByDomain(domainId),
    };
  }

  @Post()
  async create(@Param('domainId') domainId: string, @Body() payload: CreateDomainRuleDto) {
    return this.service.create(domainId, payload);
  }
}
