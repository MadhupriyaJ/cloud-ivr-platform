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
exports.DomainEntity = void 0;
const typeorm_1 = require("typeorm");
let DomainEntity = class DomainEntity {
    domainId;
    domainCode;
    displayName;
    organizationName;
    industryType;
    defaultLanguage;
    defaultVoice;
    welcomeMessage;
    fallbackMessage;
    escalationMessage;
    isActive;
    createdAt;
    updatedAt;
};
exports.DomainEntity = DomainEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'DomainId' }),
    __metadata("design:type", String)
], DomainEntity.prototype, "domainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DomainCode', unique: true, length: 80 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "domainCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DisplayName', length: 120 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'OrganizationName', length: 160 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "organizationName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IndustryType', length: 80 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "industryType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DefaultLanguage', length: 40 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "defaultLanguage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DefaultVoice', length: 60 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "defaultVoice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'WelcomeMessage', length: 500 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "welcomeMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'FallbackMessage', length: 500 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "fallbackMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'EscalationMessage', length: 500 }),
    __metadata("design:type", String)
], DomainEntity.prototype, "escalationMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IsActive', type: 'bit', default: true }),
    __metadata("design:type", Boolean)
], DomainEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DomainEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DomainEntity.prototype, "updatedAt", void 0);
exports.DomainEntity = DomainEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Domains' })
], DomainEntity);
//# sourceMappingURL=domain.entity.js.map