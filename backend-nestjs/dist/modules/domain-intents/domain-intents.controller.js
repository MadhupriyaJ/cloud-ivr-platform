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
exports.DomainIntentsController = void 0;
const common_1 = require("@nestjs/common");
const domain_intents_service_1 = require("./domain-intents.service");
const create_domain_intent_dto_1 = require("./dto/create-domain-intent.dto");
const update_domain_intent_dto_1 = require("./dto/update-domain-intent.dto");
let DomainIntentsController = class DomainIntentsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list(domainId) {
        return {
            items: await this.service.listByDomain(domainId),
        };
    }
    async create(domainId, payload) {
        return this.service.create(domainId, payload);
    }
    async update(domainId, intentId, payload) {
        return this.service.update(domainId, intentId, payload);
    }
    async remove(domainId, intentId) {
        await this.service.remove(domainId, intentId);
        return { success: true };
    }
};
exports.DomainIntentsController = DomainIntentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('domainId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DomainIntentsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('domainId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_domain_intent_dto_1.CreateDomainIntentDto]),
    __metadata("design:returntype", Promise)
], DomainIntentsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':intentId'),
    __param(0, (0, common_1.Param)('domainId')),
    __param(1, (0, common_1.Param)('intentId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_domain_intent_dto_1.UpdateDomainIntentDto]),
    __metadata("design:returntype", Promise)
], DomainIntentsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':intentId'),
    __param(0, (0, common_1.Param)('domainId')),
    __param(1, (0, common_1.Param)('intentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DomainIntentsController.prototype, "remove", null);
exports.DomainIntentsController = DomainIntentsController = __decorate([
    (0, common_1.Controller)('domains/:domainId/intents'),
    __metadata("design:paramtypes", [domain_intents_service_1.DomainIntentsService])
], DomainIntentsController);
//# sourceMappingURL=domain-intents.controller.js.map