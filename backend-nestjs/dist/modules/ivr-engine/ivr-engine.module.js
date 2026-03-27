"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrEngineModule = void 0;
const common_1 = require("@nestjs/common");
const ivr_flow_loader_service_1 = require("./ivr-flow-loader.service");
const flow_executor_service_1 = require("./flow-executor.service");
const api_integration_service_1 = require("./api-integration.service");
const ivr_engine_controller_1 = require("./ivr-engine.controller");
const mock_api_controller_1 = require("./mock-api.controller");
let IvrEngineModule = class IvrEngineModule {
};
exports.IvrEngineModule = IvrEngineModule;
exports.IvrEngineModule = IvrEngineModule = __decorate([
    (0, common_1.Module)({
        controllers: [ivr_engine_controller_1.IvrEngineController, mock_api_controller_1.MockApiController],
        providers: [
            ivr_flow_loader_service_1.IvrFlowLoaderService,
            flow_executor_service_1.FlowExecutorService,
            api_integration_service_1.ApiIntegrationService,
        ],
        exports: [
            ivr_flow_loader_service_1.IvrFlowLoaderService,
            flow_executor_service_1.FlowExecutorService,
            api_integration_service_1.ApiIntegrationService,
        ],
    })
], IvrEngineModule);
//# sourceMappingURL=ivr-engine.module.js.map