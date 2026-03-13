import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolDefinitionEntity } from './tool-definition.entity';
import { CreateToolDefinitionDto } from './dto/create-tool-definition.dto';

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
}
