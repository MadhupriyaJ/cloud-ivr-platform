import { Repository } from 'typeorm';
import { DomainIntentEntity } from './domain-intent.entity';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';
export declare class DomainIntentsService {
    private readonly repository;
    constructor(repository: Repository<DomainIntentEntity>);
    listByDomain(domainId: string): Promise<DomainIntentEntity[]>;
    create(domainId: string, payload: CreateDomainIntentDto): Promise<DomainIntentEntity>;
}
