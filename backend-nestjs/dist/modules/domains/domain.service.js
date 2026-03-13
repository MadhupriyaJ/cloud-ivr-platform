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
exports.DomainService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const domain_entity_1 = require("./domain.entity");
let DomainService = class DomainService {
    domainRepository;
    constructor(domainRepository) {
        this.domainRepository = domainRepository;
    }
    async list() {
        return this.domainRepository.find({
            order: {
                updatedAt: 'DESC',
            },
        });
    }
    async getByCode(domainCode) {
        const domain = await this.domainRepository.findOne({
            where: {
                domainCode,
            },
        });
        if (!domain) {
            throw new common_1.NotFoundException(`Domain '${domainCode}' not found.`);
        }
        return domain;
    }
    async create(payload) {
        const entity = this.domainRepository.create(payload);
        return this.domainRepository.save(entity);
    }
    async updateByCode(domainCode, payload) {
        const current = await this.getByCode(domainCode);
        const next = this.domainRepository.merge(current, payload, {
            domainCode: payload.domainCode || domainCode,
        });
        return this.domainRepository.save(next);
    }
    async deleteByCode(domainCode) {
        const current = await this.getByCode(domainCode);
        await this.domainRepository.remove(current);
    }
};
exports.DomainService = DomainService;
exports.DomainService = DomainService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(domain_entity_1.DomainEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DomainService);
//# sourceMappingURL=domain.service.js.map