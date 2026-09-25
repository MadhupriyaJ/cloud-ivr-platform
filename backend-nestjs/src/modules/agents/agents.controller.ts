import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentAvailabilityDto, UpdateAgentDto } from './dto/update-agent.dto';
import { CacheService } from '../../common/cache.service';
import { EscalationEventsService } from '../escalations/escalation-events.service';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly service: AgentsService,
    private readonly cache: CacheService,
    private readonly events: EscalationEventsService,
  ) {}

  @Get()
  async list() {
    return this.cache.getOrSet(
      'agents:list',
      async () => ({ items: await this.service.list() }),
      15_000,
    );
  }

  @Get('available')
  async listAvailable(@Query('skillGroup') skillGroup?: string) {
    return { items: await this.service.listAvailable(skillGroup) };
  }

  @Post()
  async create(@Body() payload: CreateAgentDto) {
    const agent = await this.service.create(payload);
    this.cache.invalidate('agents:list');
    return agent;
  }

  @Patch(':agentId')
  async update(@Param('agentId') agentId: string, @Body() payload: UpdateAgentDto) {
    const agent = await this.service.update(agentId, payload);
    this.cache.invalidate('agents:list');
    return agent;
  }

  /**
   * Presence toggle used by the escalation console. Going `available` makes the
   * agent eligible for queued escalations, which the escalations service drains
   * on the next dispatch pass.
   */
  @Patch(':agentId/availability')
  async setAvailability(
    @Param('agentId') agentId: string,
    @Body() payload: UpdateAgentAvailabilityDto,
  ) {
    const agent = await this.service.setAvailability(agentId, payload.availabilityStatus);
    this.cache.invalidate('agents:list');
    this.events.publish({
      type: 'agent.presence',
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        availabilityStatus: agent.availabilityStatus,
      },
    });
    return agent;
  }
}
