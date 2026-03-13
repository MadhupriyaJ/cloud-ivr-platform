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
exports.DomainController = void 0;
const common_1 = require("@nestjs/common");
const domain_intents_service_1 = require("../domain-intents/domain-intents.service");
const domain_rules_service_1 = require("../domain-rules/domain-rules.service");
const domain_service_1 = require("./domain.service");
let DomainController = class DomainController {
    domainService;
    domainIntentsService;
    domainRulesService;
    constructor(domainService, domainIntentsService, domainRulesService) {
        this.domainService = domainService;
        this.domainIntentsService = domainIntentsService;
        this.domainRulesService = domainRulesService;
    }
    async toLegacyDomain(domain) {
        const [intents, rules] = await Promise.all([
            this.domainIntentsService.listByDomain(domain.domainId),
            this.domainRulesService.listByDomain(domain.domainId),
        ]);
        return {
            domain_uuid: domain.domainId,
            domain_id: domain.domainCode,
            display_name: domain.displayName,
            industry: domain.industryType,
            organization_name: domain.organizationName,
            voice: domain.defaultVoice,
            language: domain.defaultLanguage,
            welcome_message: domain.welcomeMessage,
            intents: intents.filter((item) => item.isActive).map((item) => item.intentLabel || item.intentCode),
            rules: rules
                .filter((item) => item.isActive && item.ruleType.toLowerCase() !== 'compliance')
                .map((item) => item.ruleText),
            compliance: rules
                .filter((item) => item.isActive && item.ruleType.toLowerCase() === 'compliance')
                .map((item) => item.ruleText),
            escalation_message: domain.escalationMessage,
            active: domain.isActive,
            created_at: domain.createdAt,
            updated_at: domain.updatedAt,
        };
    }
    slugify(value) {
        return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
    }
    inferIndustry(value) {
        const text = value.toLowerCase();
        if (text.includes('hospital') || text.includes('clinic') || text.includes('health'))
            return 'healthcare';
        if (text.includes('bank') || text.includes('finance') || text.includes('loan'))
            return 'banking';
        if (text.includes('insurance'))
            return 'insurance';
        if (text.includes('logistics') || text.includes('shipment') || text.includes('delivery'))
            return 'logistics';
        return 'general';
    }
    buildSeedConfig(label, organizationName, industry) {
        if (industry === 'healthcare') {
            return {
                intents: ['appointments', 'lab reports', 'billing', 'operator'],
                rules: [
                    'Keep responses short and suitable for voice calls.',
                    'Ask only one routing question at a time.',
                    'If caller is unclear, repeat the available options.',
                ],
                compliance: ['Do not expose patient details without verification.'],
                escalationMessage: 'Connecting you to a hospital operator.',
            };
        }
        if (industry === 'banking') {
            return {
                intents: ['balance enquiry', 'card block', 'loan support', 'operator'],
                rules: [
                    'Confirm the caller intent before sensitive actions.',
                    'Keep replies concise and transaction-focused.',
                    'Ask one short question per turn.',
                ],
                compliance: ['Do not share account details before verification.'],
                escalationMessage: 'Connecting you to a banking support agent.',
            };
        }
        if (industry === 'insurance') {
            return {
                intents: ['policy status', 'claim status', 'premium enquiry', 'operator'],
                rules: [
                    'Collect the minimum information needed for routing.',
                    'Keep responses short and formal.',
                    'Escalate if policy lookup fails repeatedly.',
                ],
                compliance: ['Do not disclose policy data without verification.'],
                escalationMessage: 'Connecting you to an insurance support agent.',
            };
        }
        if (industry === 'logistics') {
            return {
                intents: ['track shipment', 'delivery issue', 'invoice enquiry', 'operator'],
                rules: [
                    'Focus on status, routing, and issue logging.',
                    'Ask for shipment reference only when needed.',
                    'Offer operator transfer after repeated failures.',
                ],
                compliance: ['Do not disclose shipment details without basic verification.'],
                escalationMessage: 'Connecting you to a logistics support agent.',
            };
        }
        return {
            intents: ['sales', 'support', 'billing', 'operator'],
            rules: [
                'Keep responses short and clear.',
                'Ask one question at a time.',
                'Offer operator transfer when the request is unclear.',
            ],
            compliance: ['Do not share confidential information without verification.'],
            escalationMessage: 'Connecting you to an operator.',
        };
    }
    async seedDomainData(domainId, seed) {
        for (let index = 0; index < seed.intents.length; index += 1) {
            const intent = seed.intents[index];
            await this.domainIntentsService.create(domainId, {
                intentCode: this.slugify(intent),
                intentLabel: intent,
                description: `${intent} support`,
                priority: (index + 1) * 10,
                isActive: true,
            });
        }
        for (let index = 0; index < seed.rules.length; index += 1) {
            await this.domainRulesService.create(domainId, {
                ruleType: 'rule',
                ruleText: seed.rules[index],
                priority: (index + 1) * 10,
                isActive: true,
            });
        }
        for (let index = 0; index < seed.compliance.length; index += 1) {
            await this.domainRulesService.create(domainId, {
                ruleType: 'compliance',
                ruleText: seed.compliance[index],
                priority: 200 + index,
                isActive: true,
            });
        }
    }
    async list() {
        const items = await this.domainService.list();
        return {
            items: await Promise.all(items.map((item) => this.toLegacyDomain(item))),
        };
    }
    async getByCode(domainCode) {
        const item = await this.domainService.getByCode(domainCode);
        return this.toLegacyDomain(item);
    }
    async generate(payload) {
        const label = payload.domain_name?.trim() || 'General Support';
        const domainCode = this.slugify(label);
        const organizationName = payload.organization_name?.trim() || `${label} Support`;
        const industry = this.inferIndustry(label);
        const seed = this.buildSeedConfig(label, organizationName, industry);
        const created = await this.domainService.create({
            domainCode,
            displayName: `${label} IVR`,
            organizationName,
            industryType: industry,
            defaultLanguage: 'English',
            defaultVoice: 'alloy',
            welcomeMessage: `Welcome to ${organizationName}. Please tell me how I can help.`,
            fallbackMessage: 'Please repeat your request or say operator.',
            escalationMessage: seed.escalationMessage,
            isActive: true,
        });
        await this.seedDomainData(created.domainId, seed);
        return this.toLegacyDomain(created);
    }
    async create(payload) {
        const created = await this.domainService.create({
            domainCode: payload.domainCode ?? payload.domain_id,
            displayName: payload.displayName ?? payload.display_name,
            organizationName: payload.organizationName ?? payload.organization_name,
            industryType: payload.industryType ?? payload.industry,
            defaultLanguage: payload.defaultLanguage ?? payload.language,
            defaultVoice: payload.defaultVoice ?? payload.voice,
            welcomeMessage: payload.welcomeMessage ?? payload.welcome_message,
            fallbackMessage: payload.fallbackMessage ?? 'Please repeat your request or say operator.',
            escalationMessage: payload.escalationMessage ?? payload.escalation_message,
            isActive: payload.isActive ?? payload.active,
        });
        return this.toLegacyDomain(created);
    }
    async update(domainCode, payload) {
        const updated = await this.domainService.updateByCode(domainCode, {
            domainCode: payload.domainCode ?? payload.domain_id ?? domainCode,
            displayName: payload.displayName ?? payload.display_name,
            organizationName: payload.organizationName ?? payload.organization_name,
            industryType: payload.industryType ?? payload.industry,
            defaultLanguage: payload.defaultLanguage ?? payload.language,
            defaultVoice: payload.defaultVoice ?? payload.voice,
            welcomeMessage: payload.welcomeMessage ?? payload.welcome_message,
            fallbackMessage: payload.fallbackMessage ?? 'Please repeat your request or say operator.',
            escalationMessage: payload.escalationMessage ?? payload.escalation_message,
            isActive: payload.isActive ?? payload.active,
        });
        return this.toLegacyDomain(updated);
    }
    async remove(domainCode) {
        await this.domainService.deleteByCode(domainCode);
        return {
            deleted: true,
            domain_id: domainCode,
        };
    }
};
exports.DomainController = DomainController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DomainController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':domainCode'),
    __param(0, (0, common_1.Param)('domainCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DomainController.prototype, "getByCode", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DomainController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DomainController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':domainCode'),
    __param(0, (0, common_1.Param)('domainCode')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DomainController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':domainCode'),
    __param(0, (0, common_1.Param)('domainCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DomainController.prototype, "remove", null);
exports.DomainController = DomainController = __decorate([
    (0, common_1.Controller)('domains'),
    __metadata("design:paramtypes", [domain_service_1.DomainService,
        domain_intents_service_1.DomainIntentsService,
        domain_rules_service_1.DomainRulesService])
], DomainController);
//# sourceMappingURL=domain.controller.js.map