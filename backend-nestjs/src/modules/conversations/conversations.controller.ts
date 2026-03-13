import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationMessageDto } from './dto/create-conversation-message.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  async list() {
    return {
      items: await this.service.list(),
    };
  }

  @Post()
  async create(@Body() payload: CreateConversationDto) {
    return this.service.create(payload);
  }

  @Get(':conversationId/messages')
  async listMessages(@Param('conversationId') conversationId: string) {
    return {
      items: await this.service.listMessages(conversationId),
    };
  }

  @Post('messages')
  async addMessage(@Body() payload: CreateConversationMessageDto) {
    return this.service.addMessage(payload);
  }
}
