"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeModule = void 0;
const common_1 = require("@nestjs/common");
const conversations_module_1 = require("../conversations/conversations.module");
const domain_intents_module_1 = require("../domain-intents/domain-intents.module");
const domain_rules_module_1 = require("../domain-rules/domain-rules.module");
const domain_module_1 = require("../domains/domain.module");
const prompt_templates_module_1 = require("../prompt-templates/prompt-templates.module");
const realtime_gateway_1 = require("./realtime.gateway");
const realtime_service_1 = require("./realtime.service");
let RealtimeModule = class RealtimeModule {
};
exports.RealtimeModule = RealtimeModule;
exports.RealtimeModule = RealtimeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            conversations_module_1.ConversationsModule,
            domain_module_1.DomainModule,
            domain_intents_module_1.DomainIntentsModule,
            domain_rules_module_1.DomainRulesModule,
            prompt_templates_module_1.PromptTemplatesModule,
        ],
        providers: [realtime_gateway_1.RealtimeGateway, realtime_service_1.RealtimeService],
    })
], RealtimeModule);
//# sourceMappingURL=realtime.module.js.map