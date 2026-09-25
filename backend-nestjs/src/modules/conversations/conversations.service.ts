import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findById(conversationId: string): Promise<ConversationEntity> {
    const conversation = await this.conversationRepository.findOne({ where: { conversationId } });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    return conversation;
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

  /** Flag the conversation as handed over to a human. */
  async markEscalated(conversationId: string): Promise<ConversationEntity> {
    const conversation = await this.findById(conversationId);
    conversation.escalatedToAgent = true;
    conversation.sessionStatus = 'escalated';
    return this.conversationRepository.save(conversation);
  }

  async assignAgent(conversationId: string, agentId: string): Promise<ConversationEntity> {
    const conversation = await this.findById(conversationId);
    conversation.assignedAgentId = agentId;
    conversation.escalatedToAgent = true;
    return this.conversationRepository.save(conversation);
  }

  async setIntent(conversationId: string, intent: string): Promise<void> {
    await this.conversationRepository.update({ conversationId }, { currentIntent: intent });
  }

  async closeConversation(conversationId: string, summaryText?: string): Promise<ConversationEntity> {
    const conversation = await this.findById(conversationId);
    if (!conversation.endedAt) {
      conversation.endedAt = new Date();
    }
    conversation.sessionStatus = 'closed';
    if (summaryText) {
      conversation.summaryText = summaryText;
    }
    return this.conversationRepository.save(conversation);
  }
}
