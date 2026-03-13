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
exports.AgentEntity = void 0;
const typeorm_1 = require("typeorm");
let AgentEntity = class AgentEntity {
    agentId;
    name;
    email;
    skillGroup;
    availabilityStatus;
    isActive;
    createdAt;
    updatedAt;
};
exports.AgentEntity = AgentEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'AgentId' }),
    __metadata("design:type", String)
], AgentEntity.prototype, "agentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Name', type: 'nvarchar', length: 120 }),
    __metadata("design:type", String)
], AgentEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Email', type: 'nvarchar', length: 180, unique: true }),
    __metadata("design:type", String)
], AgentEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SkillGroup', type: 'nvarchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], AgentEntity.prototype, "skillGroup", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'AvailabilityStatus', type: 'nvarchar', length: 40, default: 'offline' }),
    __metadata("design:type", String)
], AgentEntity.prototype, "availabilityStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IsActive', type: 'bit', default: true }),
    __metadata("design:type", Boolean)
], AgentEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], AgentEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UpdatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], AgentEntity.prototype, "updatedAt", void 0);
exports.AgentEntity = AgentEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'Agents' })
], AgentEntity);
//# sourceMappingURL=agent.entity.js.map