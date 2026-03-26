import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  async overview() {
    return this.service.getOverview();
  }

  @Get('conversation-trends')
  async conversationTrends() {
    return { items: await this.service.getConversationTrends() };
  }

  @Get('domain-distribution')
  async domainDistribution() {
    return { items: await this.service.getDomainDistribution() };
  }

  @Get('health')
  async health() {
    return this.service.getHealth();
  }
}
