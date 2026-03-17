import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PromptTemplatesService } from './prompt-templates.service';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto';

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

  @Patch(':promptTemplateId')
  async update(
    @Param('domainId') domainId: string,
    @Param('promptTemplateId') promptTemplateId: string,
    @Body() payload: UpdatePromptTemplateDto,
  ) {
    return this.service.update(domainId, promptTemplateId, payload);
  }

  @Delete(':promptTemplateId')
  async remove(@Param('domainId') domainId: string, @Param('promptTemplateId') promptTemplateId: string) {
    await this.service.remove(domainId, promptTemplateId);
    return { success: true };
  }
}
