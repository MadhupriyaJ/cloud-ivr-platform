import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationMessageDto } from './dto/create-conversation-message.dto';
export declare class ConversationsController {
    private readonly service;
    constructor(service: ConversationsService);
    list(): Promise<{
        items: import("./conversation.entity").ConversationEntity[];
    }>;
    create(payload: CreateConversationDto): Promise<import("./conversation.entity").ConversationEntity>;
    listMessages(conversationId: string): Promise<{
        items: import("./conversation-message.entity").ConversationMessageEntity[];
    }>;
    addMessage(payload: CreateConversationMessageDto): Promise<import("./conversation-message.entity").ConversationMessageEntity>;
}
