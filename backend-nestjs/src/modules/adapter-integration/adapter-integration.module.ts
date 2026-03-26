/**
 * Adapter Integration Module
 * Provides adapter routing and tool execution for NestJS backend.
 */

import { Module } from '@nestjs/common';
import { AdapterIntegrationService } from './adapter-integration.service';

@Module({
  providers: [AdapterIntegrationService],
  exports: [AdapterIntegrationService],
})
export class AdapterIntegrationModule {}
