import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplateEntity } from './prompt-template.entity';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto';

@Injectable()
export class PromptTemplatesService {
  constructor(
    @InjectRepository(PromptTemplateEntity)
    private readonly repository: Repository<PromptTemplateEntity>,
  ) {}

  async listByDomain(domainId: string): Promise<PromptTemplateEntity[]> {
    return this.repository.find({
      where: { domainId },
      order: { promptType: 'ASC', versionNo: 'DESC', createdAt: 'DESC' },
    });
  }

  async listActiveByDomain(domainId: string): Promise<PromptTemplateEntity[]> {
    return this.repository.find({
      where: { domainId, isActive: true },
      order: { promptType: 'ASC', versionNo: 'DESC', createdAt: 'DESC' },
    });
  }

  async findLatestActiveByType(
    domainId: string,
    promptType: string,
  ): Promise<PromptTemplateEntity | null> {
    return (
      (await this.repository.findOne({
        where: { domainId, promptType, isActive: true },
        order: { versionNo: 'DESC', createdAt: 'DESC' },
      })) ?? null
    );
  }

  async upsertActiveTemplate(
    domainId: string,
    payload: CreatePromptTemplateDto,
  ): Promise<PromptTemplateEntity> {
    const existing = await this.findLatestActiveByType(domainId, payload.promptType);
    if (!existing) {
      return this.create(domainId, payload);
    }

    Object.assign(existing, {
      templateText: payload.templateText,
      versionNo: payload.versionNo ?? existing.versionNo,
      isActive: payload.isActive ?? true,
    });
    return this.repository.save(existing);
  }

  async create(domainId: string, payload: CreatePromptTemplateDto): Promise<PromptTemplateEntity> {
    const entity = this.repository.create({ ...payload, domainId });
    return this.repository.save(entity);
  }

  async update(domainId: string, promptTemplateId: string, payload: UpdatePromptTemplateDto): Promise<PromptTemplateEntity> {
    const entity = await this.repository.findOne({ where: { domainId, promptTemplateId } });
    if (!entity) {
      throw new NotFoundException(`Prompt template '${promptTemplateId}' not found`);
    }
    Object.assign(entity, payload);
    return this.repository.save(entity);
  }

  async remove(domainId: string, promptTemplateId: string): Promise<void> {
    const result = await this.repository.delete({ domainId, promptTemplateId });
    if (!result.affected) {
      throw new NotFoundException(`Prompt template '${promptTemplateId}' not found`);
    }
  }
}
