import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DomainIntentsService } from './domain-intents.service';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';
import { UpdateDomainIntentDto } from './dto/update-domain-intent.dto';

@Controller('domains/:domainId/intents')
export class DomainIntentsController {
  constructor(private readonly service: DomainIntentsService) {}

  @Get()
  async list(@Param('domainId') domainId: string) {
    return {
      items: await this.service.listByDomain(domainId),
    };
  }

  @Post()
  async create(@Param('domainId') domainId: string, @Body() payload: CreateDomainIntentDto) {
    return this.service.create(domainId, payload);
  }

  @Patch(':intentId')
  async update(
    @Param('domainId') domainId: string,
    @Param('intentId') intentId: string,
    @Body() payload: UpdateDomainIntentDto,
  ) {
    return this.service.update(domainId, intentId, payload);
  }

  @Delete(':intentId')
  async remove(@Param('domainId') domainId: string, @Param('intentId') intentId: string) {
    await this.service.remove(domainId, intentId);
    return { success: true };
  }
}
