import { Repository } from 'typeorm';
import { PromptTemplateEntity } from './prompt-template.entity';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto';
export declare class PromptTemplatesService {
    private readonly repository;
    constructor(repository: Repository<PromptTemplateEntity>);
    listByDomain(domainId: string): Promise<PromptTemplateEntity[]>;
    listActiveByDomain(domainId: string): Promise<PromptTemplateEntity[]>;
    findLatestActiveByType(domainId: string, promptType: string): Promise<PromptTemplateEntity | null>;
    upsertActiveTemplate(domainId: string, payload: CreatePromptTemplateDto): Promise<PromptTemplateEntity>;
    create(domainId: string, payload: CreatePromptTemplateDto): Promise<PromptTemplateEntity>;
    update(domainId: string, promptTemplateId: string, payload: UpdatePromptTemplateDto): Promise<PromptTemplateEntity>;
    remove(domainId: string, promptTemplateId: string): Promise<void>;
}
