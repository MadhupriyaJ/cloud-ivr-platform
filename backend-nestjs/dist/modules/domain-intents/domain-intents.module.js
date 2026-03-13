"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainIntentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const domain_intent_entity_1 = require("./domain-intent.entity");
const domain_intents_controller_1 = require("./domain-intents.controller");
const domain_intents_service_1 = require("./domain-intents.service");
let DomainIntentsModule = class DomainIntentsModule {
};
exports.DomainIntentsModule = DomainIntentsModule;
exports.DomainIntentsModule = DomainIntentsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([domain_intent_entity_1.DomainIntentEntity])],
        controllers: [domain_intents_controller_1.DomainIntentsController],
        providers: [domain_intents_service_1.DomainIntentsService],
        exports: [domain_intents_service_1.DomainIntentsService],
    })
], DomainIntentsModule);
//# sourceMappingURL=domain-intents.module.js.map