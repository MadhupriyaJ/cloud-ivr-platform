import { Repository } from 'typeorm';
import { EscalationEntity } from './escalation.entity';
import { CreateEscalationDto } from './dto/create-escalation.dto';
export declare class EscalationsService {
    private readonly repository;
    constructor(repository: Repository<EscalationEntity>);
    list(): Promise<EscalationEntity[]>;
    create(payload: CreateEscalationDto): Promise<EscalationEntity>;
}
