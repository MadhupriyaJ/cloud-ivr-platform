import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationMessageDto } from './dto/create-conversation-message.dto';
import { CacheService } from '../../common/cache.service';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly service: ConversationsService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async list() {
    return this.cache.getOrSet('conversations:list', async () => ({
      items: await this.service.list(),
    }), 15_000); // 15s cache for conversations (more dynamic)
  }

  @Post()
  async create(@Body() payload: CreateConversationDto) {
    this.cache.invalidate('conversations:list');
    return this.service.create(payload);
  }

  @Get(':conversationId/messages')
  async listMessages(@Param('conversationId') conversationId: string) {
    return this.cache.getOrSet(`conversations:${conversationId}:messages`, async () => ({
      items: await this.service.listMessages(conversationId),
    }), 10_000); // 10s cache for messages
  }

  @Post('messages')
  async addMessage(@Body() payload: CreateConversationMessageDto) {
    this.cache.invalidatePrefix('conversations:');
    return this.service.addMessage(payload);
  }
}
