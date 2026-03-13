import { EscalationsService } from './escalations.service';
import { CreateEscalationDto } from './dto/create-escalation.dto';
export declare class EscalationsController {
    private readonly service;
    constructor(service: EscalationsService);
    list(): Promise<{
        items: import("./escalation.entity").EscalationEntity[];
    }>;
    create(payload: CreateEscalationDto): Promise<import("./escalation.entity").EscalationEntity>;
}
