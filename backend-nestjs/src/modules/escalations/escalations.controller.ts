import { Body, Controller, Get, Post } from '@nestjs/common';
import { EscalationsService } from './escalations.service';
import { CreateEscalationDto } from './dto/create-escalation.dto';

@Controller('escalations')
export class EscalationsController {
  constructor(private readonly service: EscalationsService) {}

  @Get()
  async list() {
    return {
      items: await this.service.list(),
    };
  }

  @Post()
  async create(@Body() payload: CreateEscalationDto) {
    return this.service.create(payload);
  }
}
