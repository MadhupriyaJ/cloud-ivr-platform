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
exports.ConversationEntity = void 0;
const typeorm_1 = require("typeorm");
let ConversationEntity = class ConversationEntity {
    conversationId;
    domainId;
    channelType;
    customerIdentifier;
    sessionStatus;
    currentIntent;
    startedAt;
    endedAt;
    escalatedToAgent;
    assignedAgentId;
    summaryText;
};
exports.ConversationEntity = ConversationEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'ConversationId' }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DomainId', type: 'uniqueidentifier' }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "domainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ChannelType', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "channelType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'CustomerIdentifier', type: 'nvarchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "customerIdentifier", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SessionStatus', type: 'nvarchar', length: 40 }),
    __metadata("design:type", String)
], ConversationEntity.prototype, "sessionStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'CurrentIntent', type: 'nvarchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "currentIntent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'StartedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], ConversationEntity.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'EndedAt', type: 'datetime2', nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'EscalatedToAgent', type: 'bit', default: false }),
    __metadata("design:type", Boolean)
], ConversationEntity.prototype, "escalatedToAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AssignedAgentId', type: 'uniqueidentifier', nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "assignedAgentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SummaryText', type: 'nvarchar', nullable: true }),
    __metadata("design:type", Object)
], ConversationEntity.prototype, "summaryText", void 0);
exports.ConversationEntity = ConversationEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Conversations' })
], ConversationEntity);
//# sourceMappingURL=conversation.entity.js.map