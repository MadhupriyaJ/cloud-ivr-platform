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
exports.DomainIntentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const domain_intent_entity_1 = require("./domain-intent.entity");
let DomainIntentsService = class DomainIntentsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async listByDomain(domainId) {
        return this.repository.find({
            where: { domainId },
            order: { priority: 'ASC', createdAt: 'ASC' },
        });
    }
    async create(domainId, payload) {
        const entity = this.repository.create({ ...payload, domainId });
        return this.repository.save(entity);
    }
    async update(domainId, intentId, payload) {
        const entity = await this.repository.findOne({ where: { domainId, intentId } });
        if (!entity) {
            throw new common_1.NotFoundException(`Intent '${intentId}' not found`);
        }
        Object.assign(entity, payload);
        return this.repository.save(entity);
    }
    async remove(domainId, intentId) {
        const result = await this.repository.delete({ domainId, intentId });
        if (!result.affected) {
            throw new common_1.NotFoundException(`Intent '${intentId}' not found`);
        }
    }
};
exports.DomainIntentsService = DomainIntentsService;
exports.DomainIntentsService = DomainIntentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(domain_intent_entity_1.DomainIntentEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DomainIntentsService);
//# sourceMappingURL=domain-intents.service.js.map