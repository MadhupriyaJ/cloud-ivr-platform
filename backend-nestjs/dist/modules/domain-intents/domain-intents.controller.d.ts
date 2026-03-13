import { DomainIntentsService } from './domain-intents.service';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';
export declare class DomainIntentsController {
    private readonly service;
    constructor(service: DomainIntentsService);
    list(domainId: string): Promise<{
        items: import("./domain-intent.entity").DomainIntentEntity[];
    }>;
    create(domainId: string, payload: CreateDomainIntentDto): Promise<import("./domain-intent.entity").DomainIntentEntity>;
}
