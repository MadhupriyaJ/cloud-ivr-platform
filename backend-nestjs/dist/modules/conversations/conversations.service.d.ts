import { Repository } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { ConversationMessageEntity } from './conversation-message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationMessageDto } from './dto/create-conversation-message.dto';
export declare class ConversationsService {
    private readonly conversationRepository;
    private readonly messageRepository;
    constructor(conversationRepository: Repository<ConversationEntity>, messageRepository: Repository<ConversationMessageEntity>);
    list(): Promise<ConversationEntity[]>;
    create(payload: CreateConversationDto): Promise<ConversationEntity>;
    addMessage(payload: CreateConversationMessageDto): Promise<ConversationMessageEntity>;
    listMessages(conversationId: string): Promise<ConversationMessageEntity[]>;
}
