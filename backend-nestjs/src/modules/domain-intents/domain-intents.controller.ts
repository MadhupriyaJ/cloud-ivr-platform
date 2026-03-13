import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DomainIntentsService } from './domain-intents.service';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';

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
}
