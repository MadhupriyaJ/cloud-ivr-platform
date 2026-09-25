import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EscalationsService } from './escalations.service';
import { CreateEscalationDto } from './dto/create-escalation.dto';
import {
  AcceptEscalationDto,
  AssignEscalationDto,
  CloseEscalationDto,
  RequeueEscalationDto,
} from './dto/escalation-action.dto';
import type { EscalationStatus } from './escalation.entity';

@Controller('escalations')
export class EscalationsController {
  constructor(private readonly service: EscalationsService) {}

  /** `status=open` (default view for the console), a concrete status, or `all`. */
  @Get()
  async list(
    @Query('status') status?: EscalationStatus | 'open' | 'all',
    @Query('agentId') agentId?: string,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      items: await this.service.list({
        status,
        agentId,
        conversationId,
        limit: limit ? Number(limit) : undefined,
      }),
    };
  }

  @Get('stats')
  async stats() {
    return this.service.stats();
  }

  @Get(':escalationId')
  async getOne(@Param('escalationId') escalationId: string) {
    return this.service.getById(escalationId);
  }

  @Post()
  async create(@Body() payload: CreateEscalationDto) {
    return this.service.create(payload);
  }

  @Post(':escalationId/assign')
  async assign(
    @Param('escalationId') escalationId: string,
    @Body() payload: AssignEscalationDto,
  ) {
    return this.service.assign(escalationId, payload.agentId);
  }

  @Post(':escalationId/accept')
  async accept(
    @Param('escalationId') escalationId: string,
    @Body() payload: AcceptEscalationDto,
  ) {
    return this.service.accept(escalationId, payload.agentId);
  }

  @Post(':escalationId/close')
  async close(@Param('escalationId') escalationId: string, @Body() payload: CloseEscalationDto) {
    return this.service.close(escalationId, payload);
  }

  @Post(':escalationId/requeue')
  async requeue(
    @Param('escalationId') escalationId: string,
    @Body() payload: RequeueEscalationDto,
  ) {
    return this.service.requeue(escalationId, payload.reason);
  }

  /** Manually drain the queue (also runs automatically on agent presence changes). */
  @Post('dispatch')
  async dispatch() {
    return { dispatched: await this.service.dispatchQueued() };
  }
}
