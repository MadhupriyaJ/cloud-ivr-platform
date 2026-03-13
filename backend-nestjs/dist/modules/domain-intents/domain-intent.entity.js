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
exports.DomainIntentEntity = void 0;
const typeorm_1 = require("typeorm");
let DomainIntentEntity = class DomainIntentEntity {
    intentId;
    domainId;
    intentCode;
    intentLabel;
    description;
    priority;
    isActive;
    createdAt;
};
exports.DomainIntentEntity = DomainIntentEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'IntentId' }),
    __metadata("design:type", String)
], DomainIntentEntity.prototype, "intentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DomainId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], DomainIntentEntity.prototype, "domainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IntentCode', type: 'nvarchar', length: 100 }),
    __metadata("design:type", String)
], DomainIntentEntity.prototype, "intentCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IntentLabel', type: 'nvarchar', length: 120 }),
    __metadata("design:type", String)
], DomainIntentEntity.prototype, "intentLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Description', type: 'nvarchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], DomainIntentEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Priority', type: 'int', default: 100 }),
    __metadata("design:type", Number)
], DomainIntentEntity.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IsActive', type: 'bit', default: true }),
    __metadata("design:type", Boolean)
], DomainIntentEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], DomainIntentEntity.prototype, "createdAt", void 0);
exports.DomainIntentEntity = DomainIntentEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'DomainIntents' })
], DomainIntentEntity);
//# sourceMappingURL=domain-intent.entity.js.map