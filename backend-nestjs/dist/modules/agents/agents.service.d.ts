import { Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
export declare class AgentsService {
    private readonly repository;
    constructor(repository: Repository<AgentEntity>);
    list(): Promise<AgentEntity[]>;
    create(payload: CreateAgentDto): Promise<AgentEntity>;
}
