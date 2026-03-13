import { Repository } from 'typeorm';
import { PromptTemplateEntity } from './prompt-template.entity';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
export declare class PromptTemplatesService {
    private readonly repository;
    constructor(repository: Repository<PromptTemplateEntity>);
    listByDomain(domainId: string): Promise<PromptTemplateEntity[]>;
    create(domainId: string, payload: CreatePromptTemplateDto): Promise<PromptTemplateEntity>;
}
