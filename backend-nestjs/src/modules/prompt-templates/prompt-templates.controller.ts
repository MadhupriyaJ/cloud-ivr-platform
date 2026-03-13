import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PromptTemplatesService } from './prompt-templates.service';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';

@Controller('domains/:domainId/prompts')
export class PromptTemplatesController {
  constructor(private readonly service: PromptTemplatesService) {}

  @Get()
  async list(@Param('domainId') domainId: string) {
    return {
      items: await this.service.listByDomain(domainId),
    };
  }

  @Post()
  async create(@Param('domainId') domainId: string, @Body() payload: CreatePromptTemplateDto) {
    return this.service.create(domainId, payload);
  }
}
