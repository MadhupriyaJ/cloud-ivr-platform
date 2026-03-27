import { Body, Controller, Get, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CacheService } from '../../common/cache.service';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly service: AgentsService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async list() {
    return this.cache.getOrSet('agents:list', async () => ({
      items: await this.service.list(),
    }), 60_000);
  }

  @Post()
  async create(@Body() payload: CreateAgentDto) {
    this.cache.invalidate('agents:list');
    return this.service.create(payload);
  }
}
