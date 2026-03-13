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
exports.ConversationMessageEntity = void 0;
const typeorm_1 = require("typeorm");
let ConversationMessageEntity = class ConversationMessageEntity {
    messageId;
    conversationId;
    speakerType;
    messageType;
    messageText;
    sequenceNo;
    createdAt;
};
exports.ConversationMessageEntity = ConversationMessageEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'MessageId' }),
    __metadata("design:type", String)
], ConversationMessageEntity.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ConversationId' }),
    __metadata("design:type", String)
], ConversationMessageEntity.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SpeakerType', length: 40 }),
    __metadata("design:type", String)
], ConversationMessageEntity.prototype, "speakerType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'MessageType', length: 40 }),
    __metadata("design:type", String)
], ConversationMessageEntity.prototype, "messageType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'MessageText', type: 'nvarchar' }),
    __metadata("design:type", String)
], ConversationMessageEntity.prototype, "messageText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SequenceNo', type: 'bigint' }),
    __metadata("design:type", Number)
], ConversationMessageEntity.prototype, "sequenceNo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], ConversationMessageEntity.prototype, "createdAt", void 0);
exports.ConversationMessageEntity = ConversationMessageEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'ConversationMessages' })
], ConversationMessageEntity);
//# sourceMappingURL=conversation-message.entity.js.map