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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplatesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const prompt_template_entity_1 = require("./prompt-template.entity");
let PromptTemplatesService = class PromptTemplatesService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async listByDomain(domainId) {
        return this.repository.find({
            where: { domainId },
            order: { promptType: 'ASC', versionNo: 'DESC', createdAt: 'DESC' },
        });
    }
    async listActiveByDomain(domainId) {
        return this.repository.find({
            where: { domainId, isActive: true },
            order: { promptType: 'ASC', versionNo: 'DESC', createdAt: 'DESC' },
        });
    }
    async findLatestActiveByType(domainId, promptType) {
        return ((await this.repository.findOne({
            where: { domainId, promptType, isActive: true },
            order: { versionNo: 'DESC', createdAt: 'DESC' },
        })) ?? null);
    }
    async upsertActiveTemplate(domainId, payload) {
        const existing = await this.findLatestActiveByType(domainId, payload.promptType);
        if (!existing) {
            return this.create(domainId, payload);
        }
        Object.assign(existing, {
            templateText: payload.templateText,
            versionNo: payload.versionNo ?? existing.versionNo,
            isActive: payload.isActive ?? true,
        });
        return this.repository.save(existing);
    }
    async create(domainId, payload) {
        const entity = this.repository.create({ ...payload, domainId });
        return this.repository.save(entity);
    }
    async update(domainId, promptTemplateId, payload) {
        const entity = await this.repository.findOne({ where: { domainId, promptTemplateId } });
        if (!entity) {
            throw new common_1.NotFoundException(`Prompt template '${promptTemplateId}' not found`);
        }
        Object.assign(entity, payload);
        return this.repository.save(entity);
    }
    async remove(domainId, promptTemplateId) {
        const result = await this.repository.delete({ domainId, promptTemplateId });
        if (!result.affected) {
            throw new common_1.NotFoundException(`Prompt template '${promptTemplateId}' not found`);
        }
    }
};
exports.PromptTemplatesService = PromptTemplatesService;
exports.PromptTemplatesService = PromptTemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(prompt_template_entity_1.PromptTemplateEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PromptTemplatesService);
//# sourceMappingURL=prompt-templates.service.js.map