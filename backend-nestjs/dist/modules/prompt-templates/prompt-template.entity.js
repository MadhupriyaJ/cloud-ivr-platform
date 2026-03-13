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
exports.PromptTemplateEntity = void 0;
const typeorm_1 = require("typeorm");
let PromptTemplateEntity = class PromptTemplateEntity {
    promptTemplateId;
    domainId;
    promptType;
    templateText;
    versionNo;
    isActive;
    createdAt;
};
exports.PromptTemplateEntity = PromptTemplateEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', { name: 'PromptTemplateId' }),
    __metadata("design:type", String)
], PromptTemplateEntity.prototype, "promptTemplateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DomainId' }),
    __metadata("design:type", String)
], PromptTemplateEntity.prototype, "domainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PromptType', length: 60 }),
    __metadata("design:type", String)
], PromptTemplateEntity.prototype, "promptType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'TemplateText', type: 'nvarchar' }),
    __metadata("design:type", String)
], PromptTemplateEntity.prototype, "templateText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'VersionNo', type: 'int', default: 1 }),
    __metadata("design:type", Number)
], PromptTemplateEntity.prototype, "versionNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'IsActive', type: 'bit', default: true }),
    __metadata("design:type", Boolean)
], PromptTemplateEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CreatedAt', type: 'datetime2' }),
    __metadata("design:type", Date)
], PromptTemplateEntity.prototype, "createdAt", void 0);
exports.PromptTemplateEntity = PromptTemplateEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'PromptTemplates' })
], PromptTemplateEntity);
//# sourceMappingURL=prompt-template.entity.js.map