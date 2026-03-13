import { Repository } from 'typeorm';
import { ToolDefinitionEntity } from './tool-definition.entity';
import { CreateToolDefinitionDto } from './dto/create-tool-definition.dto';
export declare class ToolDefinitionsService {
    private readonly repository;
    constructor(repository: Repository<ToolDefinitionEntity>);
    listByDomain(domainId: string): Promise<ToolDefinitionEntity[]>;
    create(domainId: string, payload: CreateToolDefinitionDto): Promise<ToolDefinitionEntity>;
}
