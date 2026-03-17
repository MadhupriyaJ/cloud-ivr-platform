import { PromptTemplatesService } from './prompt-templates.service';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto';
export declare class PromptTemplatesController {
    private readonly service;
    constructor(service: PromptTemplatesService);
    list(domainId: string): Promise<{
        items: import("./prompt-template.entity").PromptTemplateEntity[];
    }>;
    create(domainId: string, payload: CreatePromptTemplateDto): Promise<import("./prompt-template.entity").PromptTemplateEntity>;
    update(domainId: string, promptTemplateId: string, payload: UpdatePromptTemplateDto): Promise<import("./prompt-template.entity").PromptTemplateEntity>;
    remove(domainId: string, promptTemplateId: string): Promise<{
        success: boolean;
    }>;
}
