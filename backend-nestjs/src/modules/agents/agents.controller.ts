import { Body, Controller, Get, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get()
  async list() {
    return {
      items: await this.service.list(),
    };
  }

  @Post()
  async create(@Body() payload: CreateAgentDto) {
    return this.service.create(payload);
  }
}
