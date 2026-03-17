import { DomainIntentsService } from './domain-intents.service';
import { CreateDomainIntentDto } from './dto/create-domain-intent.dto';
import { UpdateDomainIntentDto } from './dto/update-domain-intent.dto';
export declare class DomainIntentsController {
    private readonly service;
    constructor(service: DomainIntentsService);
    list(domainId: string): Promise<{
        items: import("./domain-intent.entity").DomainIntentEntity[];
    }>;
    create(domainId: string, payload: CreateDomainIntentDto): Promise<import("./domain-intent.entity").DomainIntentEntity>;
    update(domainId: string, intentId: string, payload: UpdateDomainIntentDto): Promise<import("./domain-intent.entity").DomainIntentEntity>;
    remove(domainId: string, intentId: string): Promise<{
        success: boolean;
    }>;
}
