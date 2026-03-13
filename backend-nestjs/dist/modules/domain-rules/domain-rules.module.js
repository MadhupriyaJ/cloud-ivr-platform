"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainRulesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const domain_rule_entity_1 = require("./domain-rule.entity");
const domain_rules_controller_1 = require("./domain-rules.controller");
const domain_rules_service_1 = require("./domain-rules.service");
let DomainRulesModule = class DomainRulesModule {
};
exports.DomainRulesModule = DomainRulesModule;
exports.DomainRulesModule = DomainRulesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([domain_rule_entity_1.DomainRuleEntity])],
        controllers: [domain_rules_controller_1.DomainRulesController],
        providers: [domain_rules_service_1.DomainRulesService],
        exports: [domain_rules_service_1.DomainRulesService],
    })
], DomainRulesModule);
//# sourceMappingURL=domain-rules.module.js.map