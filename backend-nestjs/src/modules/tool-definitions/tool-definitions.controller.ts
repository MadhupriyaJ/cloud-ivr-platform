import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ToolDefinitionsService } from './tool-definitions.service';
import { CreateToolDefinitionDto } from './dto/create-tool-definition.dto';

@Controller('domains/:domainId/tools')
export class ToolDefinitionsController {
  constructor(private readonly service: ToolDefinitionsService) {}

  @Get()
  async list(@Param('domainId') domainId: string) {
    return {
      items: await this.service.listByDomain(domainId),
    };
  }

  @Post()
  async create(@Param('domainId') domainId: string, @Body() payload: CreateToolDefinitionDto) {
    return this.service.create(domainId, payload);
  }
}
