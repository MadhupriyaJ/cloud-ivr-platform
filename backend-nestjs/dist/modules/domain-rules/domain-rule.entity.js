"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainRuleEntity = void 0;
const typeorm_1 = require("typeorm");
let DomainRuleEntity = class DomainRuleEntity {
    ruleId;
    domainId;
    ruleType;
    ruleText;
    priority;
    isActive;
    createdAt;
};
exports.DomainRuleEntity = DomainRuleEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'RuleId' }),
    __metadata("design:type", String)
], DomainRuleEntity.prototype, "ruleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DomainId' }),
    __metadata("design:type", String)
], DomainRuleEntity.prototype, "domainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'RuleType', length: 60 }),
    __metadata("design:type", String)
], DomainRuleEntity.prototype, "ruleType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'RuleText', length: 1000 }),
    __metadata("design:type", String)
], DomainRuleEntity.prototype, "ruleText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Priority', type: 'int', default: 100 }),
    __metadata("design:type", Number)
], DomainRuleEntity.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IsActive', type: 'bit', default: true }),
    __metadata("design:type", Boolean)
], DomainRuleEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DomainRuleEntity.prototype, "createdAt", void 0);
exports.DomainRuleEntity = DomainRuleEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'DomainRules' })
], DomainRuleEntity);
//# sourceMappingURL=domain-rule.entity.js.map