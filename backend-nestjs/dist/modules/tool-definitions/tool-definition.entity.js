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
exports.ToolDefinitionEntity = void 0;
const typeorm_1 = require("typeorm");
let ToolDefinitionEntity = class ToolDefinitionEntity {
    toolId;
    domainId;
    toolName;
    description;
    schemaJson;
    handlerName;
    isActive;
    createdAt;
};
exports.ToolDefinitionEntity = ToolDefinitionEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'ToolId' }),
    __metadata("design:type", String)
], ToolDefinitionEntity.prototype, "toolId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DomainId' }),
    __metadata("design:type", String)
], ToolDefinitionEntity.prototype, "domainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ToolName', length: 120 }),
    __metadata("design:type", String)
], ToolDefinitionEntity.prototype, "toolName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'Description', length: 255 }),
    __metadata("design:type", String)
], ToolDefinitionEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SchemaJson', type: 'nvarchar' }),
    __metadata("design:type", String)
], ToolDefinitionEntity.prototype, "schemaJson", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'HandlerName', length: 180 }),
    __metadata("design:type", String)
], ToolDefinitionEntity.prototype, "handlerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IsActive', type: 'bit', default: true }),
    __metadata("design:type", Boolean)
], ToolDefinitionEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], ToolDefinitionEntity.prototype, "createdAt", void 0);
exports.ToolDefinitionEntity = ToolDefinitionEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'ToolDefinitions' })
], ToolDefinitionEntity);
//# sourceMappingURL=tool-definition.entity.js.map