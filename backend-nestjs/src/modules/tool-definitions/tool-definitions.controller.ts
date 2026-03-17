import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ToolDefinitionsService } from './tool-definitions.service';
import { CreateToolDefinitionDto } from './dto/create-tool-definition.dto';
import { UpdateToolDefinitionDto } from './dto/update-tool-definition.dto';

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

  @Patch(':toolId')
  async update(
    @Param('domainId') domainId: string,
    @Param('toolId') toolId: string,
    @Body() payload: UpdateToolDefinitionDto,
  ) {
    return this.service.update(domainId, toolId, payload);
  }

  @Delete(':toolId')
  async remove(@Param('domainId') domainId: string, @Param('toolId') toolId: string) {
    await this.service.remove(domainId, toolId);
    return { success: true };
  }
}
