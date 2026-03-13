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
exports.PromptTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const prompt_templates_service_1 = require("./prompt-templates.service");
const create_prompt_template_dto_1 = require("./dto/create-prompt-template.dto");
let PromptTemplatesController = class PromptTemplatesController {
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
};
exports.PromptTemplatesController = PromptTemplatesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('domainId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PromptTemplatesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Param)('domainId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_prompt_template_dto_1.CreatePromptTemplateDto]),
    __metadata("design:returntype", Promise)
], PromptTemplatesController.prototype, "create", null);
exports.PromptTemplatesController = PromptTemplatesController = __decorate([
    (0, common_1.Controller)('domains/:domainId/prompts'),
    __metadata("design:paramtypes", [prompt_templates_service_1.PromptTemplatesService])
], PromptTemplatesController);
//# sourceMappingURL=prompt-templates.controller.js.map