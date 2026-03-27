import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DomainRulesService } from './domain-rules.service';
import { CreateDomainRuleDto } from './dto/create-domain-rule.dto';
import { UpdateDomainRuleDto } from './dto/update-domain-rule.dto';
import { CacheService } from '../../common/cache.service';

@Controller('domains/:domainId/rules')
export class DomainRulesController {
  constructor(
    private readonly service: DomainRulesService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async list(@Param('domainId') domainId: string) {
    return this.cache.getOrSet(`rules:${domainId}`, async () => ({
      items: await this.service.listByDomain(domainId),
    }), 60_000);
  }

  @Post()
  async create(@Param('domainId') domainId: string, @Body() payload: CreateDomainRuleDto) {
    this.cache.invalidate(`rules:${domainId}`);
    this.cache.invalidatePrefix('domains:');
    return this.service.create(domainId, payload);
  }

  @Patch(':ruleId')
  async update(
    @Param('domainId') domainId: string,
    @Param('ruleId') ruleId: string,
    @Body() payload: UpdateDomainRuleDto,
  ) {
    this.cache.invalidate(`rules:${domainId}`);
    this.cache.invalidatePrefix('domains:');
    return this.service.update(domainId, ruleId, payload);
  }

  @Delete(':ruleId')
  async remove(@Param('domainId') domainId: string, @Param('ruleId') ruleId: string) {
    this.cache.invalidate(`rules:${domainId}`);
    this.cache.invalidatePrefix('domains:');
    await this.service.remove(domainId, ruleId);
    return { success: true };
  }
}
