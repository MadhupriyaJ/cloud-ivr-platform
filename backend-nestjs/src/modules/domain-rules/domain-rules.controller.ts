import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DomainRulesService } from './domain-rules.service';
import { CreateDomainRuleDto } from './dto/create-domain-rule.dto';
import { UpdateDomainRuleDto } from './dto/update-domain-rule.dto';

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

  @Patch(':ruleId')
  async update(
    @Param('domainId') domainId: string,
    @Param('ruleId') ruleId: string,
    @Body() payload: UpdateDomainRuleDto,
  ) {
    return this.service.update(domainId, ruleId, payload);
  }

  @Delete(':ruleId')
  async remove(@Param('domainId') domainId: string, @Param('ruleId') ruleId: string) {
    await this.service.remove(domainId, ruleId);
    return { success: true };
  }
}
