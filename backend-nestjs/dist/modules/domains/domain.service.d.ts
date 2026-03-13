import { Repository } from 'typeorm';
import { DomainEntity } from './domain.entity';
import { CreateDomainDto } from './dto/create-domain.dto';
export declare class DomainService {
    private readonly domainRepository;
    constructor(domainRepository: Repository<DomainEntity>);
    list(): Promise<DomainEntity[]>;
    getByCode(domainCode: string): Promise<DomainEntity>;
    create(payload: CreateDomainDto): Promise<DomainEntity>;
    updateByCode(domainCode: string, payload: CreateDomainDto): Promise<DomainEntity>;
    deleteByCode(domainCode: string): Promise<void>;
}
