"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const serve_static_1 = require("@nestjs/serve-static");
const app_controller_1 = require("./app.controller");
const database_config_1 = require("./config/database.config");
const azure_config_1 = require("./config/azure.config");
const agents_module_1 = require("./modules/agents/agents.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const domain_module_1 = require("./modules/domains/domain.module");
const domain_intents_module_1 = require("./modules/domain-intents/domain-intents.module");
const domain_rules_module_1 = require("./modules/domain-rules/domain-rules.module");
const escalations_module_1 = require("./modules/escalations/escalations.module");
const prompt_templates_module_1 = require("./modules/prompt-templates/prompt-templates.module");
const realtime_module_1 = require("./modules/realtime/realtime.module");
const speech_module_1 = require("./modules/speech/speech.module");
const tool_definitions_module_1 = require("./modules/tool-definitions/tool-definitions.module");
const hospital_module_1 = require("./modules/hospital/hospital.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const ivr_engine_module_1 = require("./modules/ivr-engine/ivr-engine.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env'],
                load: [database_config_1.databaseConfig, azure_config_1.azureConfig],
            }),
            typeorm_1.TypeOrmModule.forRootAsync(database_config_1.databaseConfig.asTypeOrmFactory()),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(__dirname, '..', 'public'),
                exclude: ['/api{*path}', '/ws{*path}', '/health'],
            }),
            agents_module_1.AgentsModule,
            conversations_module_1.ConversationsModule,
            domain_module_1.DomainModule,
            domain_intents_module_1.DomainIntentsModule,
            domain_rules_module_1.DomainRulesModule,
            escalations_module_1.EscalationsModule,
            prompt_templates_module_1.PromptTemplatesModule,
            realtime_module_1.RealtimeModule,
            speech_module_1.SpeechModule,
            tool_definitions_module_1.ToolDefinitionsModule,
            hospital_module_1.HospitalModule,
            analytics_module_1.AnalyticsModule,
            ivr_engine_module_1.IvrEngineModule,
        ],
        controllers: [app_controller_1.AppController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map