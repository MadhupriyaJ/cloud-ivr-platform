import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationEntity } from './conversation.entity';
import { ConversationMessageEntity } from './conversation-message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationMessageDto } from './dto/create-conversation-message.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepository: Repository<ConversationEntity>,
    @InjectRepository(ConversationMessageEntity)
    private readonly messageRepository: Repository<ConversationMessageEntity>,
  ) {}

  async list(): Promise<ConversationEntity[]> {
    return this.conversationRepository.find({
      order: { startedAt: 'DESC' },
      take: 100,
    });
  }

  async create(payload: CreateConversationDto): Promise<ConversationEntity> {
    const entity = this.conversationRepository.create({
      ...payload,
      sessionStatus: 'started',
      startedAt: new Date(),
    });
    return this.conversationRepository.save(entity);
  }

  async addMessage(payload: CreateConversationMessageDto): Promise<ConversationMessageEntity> {
    const entity = this.messageRepository.create(payload);
    return this.messageRepository.save(entity);
  }

  async listMessages(conversationId: string): Promise<ConversationMessageEntity[]> {
    return this.messageRepository.find({
      where: { conversationId },
      order: { sequenceNo: 'ASC', createdAt: 'ASC' },
    });
  }
}
