import { Module } from '@nestjs/common';
import { IvrFlowLoaderService } from './ivr-flow-loader.service';
import { FlowExecutorService } from './flow-executor.service';
import { ApiIntegrationService } from './api-integration.service';
import { IvrEngineController } from './ivr-engine.controller';
import { MockApiController } from './mock-api.controller';

/**
 * IvrEngineModule
 * 
 * The Generic IVR Engine module.
 * Provides configurable, domain-driven IVR flow execution.
 * 
 * Components:
 * - IvrFlowLoaderService: Loads flow configurations from DB
 * - FlowExecutorService: State machine that executes flow nodes
 * - ApiIntegrationService: REST adapter for domain API calls
 * - IvrEngineController: REST endpoints for flow management and execution
 */
@Module({
  controllers: [IvrEngineController, MockApiController],
  providers: [
    IvrFlowLoaderService,
    FlowExecutorService,
    ApiIntegrationService,
  ],
  exports: [
    IvrFlowLoaderService,
    FlowExecutorService,
    ApiIntegrationService,
  ],
})
export class IvrEngineModule {}
