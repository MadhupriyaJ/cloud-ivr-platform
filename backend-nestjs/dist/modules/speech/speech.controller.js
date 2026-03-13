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
exports.SpeechController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let SpeechController = class SpeechController {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    async issueToken() {
        const region = this.configService.get('azure.speechRegion') || process.env.AZURE_SPEECH_REGION;
        const apiKey = this.configService.get('azure.speechApiKey') || process.env.AZURE_SPEECH_API_KEY;
        if (!region || !apiKey) {
            throw new common_1.HttpException('Azure Speech configuration missing.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': '0',
            },
        });
        if (!response.ok) {
            throw new common_1.HttpException(`Azure Speech token request failed with status ${response.status}.`, common_1.HttpStatus.BAD_GATEWAY);
        }
        const token = await response.text();
        return {
            token,
            region,
        };
    }
};
exports.SpeechController = SpeechController;
__decorate([
    (0, common_1.Get)('token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SpeechController.prototype, "issueToken", null);
exports.SpeechController = SpeechController = __decorate([
    (0, common_1.Controller)('speech'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SpeechController);
//# sourceMappingURL=speech.controller.js.map