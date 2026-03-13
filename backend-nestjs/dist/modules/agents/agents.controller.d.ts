import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
export declare class AgentsController {
    private readonly service;
    constructor(service: AgentsService);
    list(): Promise<{
        items: import("./agent.entity").AgentEntity[];
    }>;
    create(payload: CreateAgentDto): Promise<import("./agent.entity").AgentEntity>;
}
