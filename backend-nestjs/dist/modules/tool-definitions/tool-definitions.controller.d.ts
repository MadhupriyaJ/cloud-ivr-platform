import { ToolDefinitionsService } from './tool-definitions.service';
import { CreateToolDefinitionDto } from './dto/create-tool-definition.dto';
export declare class ToolDefinitionsController {
    private readonly service;
    constructor(service: ToolDefinitionsService);
    list(domainId: string): Promise<{
        items: import("./tool-definition.entity").ToolDefinitionEntity[];
    }>;
    create(domainId: string, payload: CreateToolDefinitionDto): Promise<import("./tool-definition.entity").ToolDefinitionEntity>;
}
