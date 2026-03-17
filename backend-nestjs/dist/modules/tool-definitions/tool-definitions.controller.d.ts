import { ToolDefinitionsService } from './tool-definitions.service';
import { CreateToolDefinitionDto } from './dto/create-tool-definition.dto';
import { UpdateToolDefinitionDto } from './dto/update-tool-definition.dto';
export declare class ToolDefinitionsController {
    private readonly service;
    constructor(service: ToolDefinitionsService);
    list(domainId: string): Promise<{
        items: import("./tool-definition.entity").ToolDefinitionEntity[];
    }>;
    create(domainId: string, payload: CreateToolDefinitionDto): Promise<import("./tool-definition.entity").ToolDefinitionEntity>;
    update(domainId: string, toolId: string, payload: UpdateToolDefinitionDto): Promise<import("./tool-definition.entity").ToolDefinitionEntity>;
    remove(domainId: string, toolId: string): Promise<{
        success: boolean;
    }>;
}
