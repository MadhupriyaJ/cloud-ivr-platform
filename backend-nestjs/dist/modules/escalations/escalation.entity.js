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
exports.EscalationEntity = void 0;
const typeorm_1 = require("typeorm");
let EscalationEntity = class EscalationEntity {
    escalationId;
    conversationId;
    escalationReason;
    escalatedAt;
    assignedAgentId;
    acceptedAt;
    closedAt;
};
exports.EscalationEntity = EscalationEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'EscalationId' }),
    __metadata("design:type", String)
], EscalationEntity.prototype, "escalationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ConversationId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], EscalationEntity.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'EscalationReason', type: 'nvarchar', length: 255 }),
    __metadata("design:type", String)
], EscalationEntity.prototype, "escalationReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'EscalatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], EscalationEntity.prototype, "escalatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AssignedAgentId', type: 'uniqueidentifier', nullable: true }),
    __metadata("design:type", Object)
], EscalationEntity.prototype, "assignedAgentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AcceptedAt', type: 'datetime2', nullable: true }),
    __metadata("design:type", Object)
], EscalationEntity.prototype, "acceptedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ClosedAt', type: 'datetime2', nullable: true }),
    __metadata("design:type", Object)
], EscalationEntity.prototype, "closedAt", void 0);
exports.EscalationEntity = EscalationEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Escalations' })
], EscalationEntity);
//# sourceMappingURL=escalation.entity.js.map