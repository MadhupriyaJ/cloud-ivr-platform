export declare class EscalationEntity {
    escalationId: string;
    conversationId: string;
    escalationReason: string;
    escalatedAt: Date;
    assignedAgentId: string | null;
    acceptedAt: Date | null;
    closedAt: Date | null;
}
