import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DomainIntentsService } from './domain-intents.service';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';
import { UpdateDomainIntentDto } from './dto/update-domain-intent.dto';
import { CacheService } from '../../common/cache.service';

@Controller('domains/:domainId/intents')
export class DomainIntentsController {
  constructor(
    private readonly service: DomainIntentsService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async list(@Param('domainId') domainId: string) {
    return this.cache.getOrSet(`intents:${domainId}`, async () => ({
      items: await this.service.listByDomain(domainId),
    }), 60_000);
  }

  @Post()
  async create(@Param('domainId') domainId: string, @Body() payload: CreateDomainIntentDto) {
    this.cache.invalidate(`intents:${domainId}`);
    this.cache.invalidatePrefix('domains:');
    return this.service.create(domainId, payload);
  }

  @Patch(':intentId')
  async update(
    @Param('domainId') domainId: string,
    @Param('intentId') intentId: string,
    @Body() payload: UpdateDomainIntentDto,
  ) {
    this.cache.invalidate(`intents:${domainId}`);
    this.cache.invalidatePrefix('domains:');
    return this.service.update(domainId, intentId, payload);
  }

  @Delete(':intentId')
  async remove(@Param('domainId') domainId: string, @Param('intentId') intentId: string) {
    this.cache.invalidate(`intents:${domainId}`);
    this.cache.invalidatePrefix('domains:');
    await this.service.remove(domainId, intentId);
    return { success: true };
  }
}
