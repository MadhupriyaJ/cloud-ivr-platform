export declare class ConversationEntity {
    conversationId: string;
    domainId: string;
    channelType: string;
    customerIdentifier: string | null;
    sessionStatus: string;
    currentIntent: string | null;
    startedAt: Date;
    endedAt: Date | null;
    escalatedToAgent: boolean;
    assignedAgentId: string | null;
    summaryText: string | null;
}
