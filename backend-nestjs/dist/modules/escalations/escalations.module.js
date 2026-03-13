"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const escalation_entity_1 = require("./escalation.entity");
const escalations_controller_1 = require("./escalations.controller");
const escalations_service_1 = require("./escalations.service");
let EscalationsModule = class EscalationsModule {
};
exports.EscalationsModule = EscalationsModule;
exports.EscalationsModule = EscalationsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([escalation_entity_1.EscalationEntity])],
        controllers: [escalations_controller_1.EscalationsController],
        providers: [escalations_service_1.EscalationsService],
        exports: [escalations_service_1.EscalationsService],
    })
], EscalationsModule);
//# sourceMappingURL=escalations.module.js.map