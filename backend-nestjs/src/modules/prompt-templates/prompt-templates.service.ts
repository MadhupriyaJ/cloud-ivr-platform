import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplateEntity } from './prompt-template.entity';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';

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

  async create(domainId: string, payload: CreatePromptTemplateDto): Promise<PromptTemplateEntity> {
    const entity = this.repository.create({ ...payload, domainId });
    return this.repository.save(entity);
  }
}
