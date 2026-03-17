import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolDefinitionEntity } from './tool-definition.entity';
import { CreateToolDefinitionDto } from './dto/create-tool-definition.dto';
import { UpdateToolDefinitionDto } from './dto/update-tool-definition.dto';

@Injectable()
export class ToolDefinitionsService {
  constructor(
    @InjectRepository(ToolDefinitionEntity)
    private readonly repository: Repository<ToolDefinitionEntity>,
  ) {}

  async listByDomain(domainId: string): Promise<ToolDefinitionEntity[]> {
    return this.repository.find({
      where: { domainId },
      order: { toolName: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(domainId: string, payload: CreateToolDefinitionDto): Promise<ToolDefinitionEntity> {
    const entity = this.repository.create({ ...payload, domainId });
    return this.repository.save(entity);
  }

  async update(domainId: string, toolId: string, payload: UpdateToolDefinitionDto): Promise<ToolDefinitionEntity> {
    const entity = await this.repository.findOne({ where: { domainId, toolId } });
    if (!entity) {
      throw new NotFoundException(`Tool '${toolId}' not found`);
    }
    Object.assign(entity, payload);
    return this.repository.save(entity);
  }

  async remove(domainId: string, toolId: string): Promise<void> {
    const result = await this.repository.delete({ domainId, toolId });
    if (!result.affected) {
      throw new NotFoundException(`Tool '${toolId}' not found`);
    }
  }
}
