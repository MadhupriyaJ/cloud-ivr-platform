"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolDefinitionsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const tool_definition_entity_1 = require("./tool-definition.entity");
const tool_definitions_controller_1 = require("./tool-definitions.controller");
const tool_definitions_service_1 = require("./tool-definitions.service");
let ToolDefinitionsModule = class ToolDefinitionsModule {
};
exports.ToolDefinitionsModule = ToolDefinitionsModule;
exports.ToolDefinitionsModule = ToolDefinitionsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([tool_definition_entity_1.ToolDefinitionEntity])],
        controllers: [tool_definitions_controller_1.ToolDefinitionsController],
        providers: [tool_definitions_service_1.ToolDefinitionsService],
        exports: [tool_definitions_service_1.ToolDefinitionsService],
    })
], ToolDefinitionsModule);
//# sourceMappingURL=tool-definitions.module.js.map