import { Controller, Get, Post } from '@nestjs/common';
import { CacheService } from './common/cache.service';

@Controller()
export class AppController {
  constructor(private readonly cache: CacheService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'generic-ivr-platform-backend',
    };
  }

  @Get('cache/stats')
  cacheStats() {
    return this.cache.getStats();
  }

  @Post('cache/clear')
  cacheClear() {
    this.cache.clear();
    return { success: true, message: 'All caches cleared' };
  }
}
