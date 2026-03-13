"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptTemplatesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const prompt_template_entity_1 = require("./prompt-template.entity");
const prompt_templates_controller_1 = require("./prompt-templates.controller");
const prompt_templates_service_1 = require("./prompt-templates.service");
let PromptTemplatesModule = class PromptTemplatesModule {
};
exports.PromptTemplatesModule = PromptTemplatesModule;
exports.PromptTemplatesModule = PromptTemplatesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([prompt_template_entity_1.PromptTemplateEntity])],
        controllers: [prompt_templates_controller_1.PromptTemplatesController],
        providers: [prompt_templates_service_1.PromptTemplatesService],
        exports: [prompt_templates_service_1.PromptTemplatesService],
    })
], PromptTemplatesModule);
//# sourceMappingURL=prompt-templates.module.js.map