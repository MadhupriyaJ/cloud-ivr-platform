import { PromptTemplatesService } from './prompt-templates.service';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
export declare class PromptTemplatesController {
    private readonly service;
    constructor(service: PromptTemplatesService);
    list(domainId: string): Promise<{
        items: import("./prompt-template.entity").PromptTemplateEntity[];
    }>;
    create(domainId: string, payload: CreatePromptTemplateDto): Promise<import("./prompt-template.entity").PromptTemplateEntity>;
}
