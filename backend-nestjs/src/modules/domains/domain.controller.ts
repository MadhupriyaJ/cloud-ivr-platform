import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { DomainIntentsService } from '../domain-intents/domain-intents.service';
import { DomainRulesService } from '../domain-rules/domain-rules.service';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';

@Controller('domains')
export class DomainController {
  constructor(
    private readonly domainService: DomainService,
    private readonly domainIntentsService: DomainIntentsService,
    private readonly domainRulesService: DomainRulesService,
  ) {}

  private async toLegacyDomain(domain: any) {
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

  private slugify(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
  }

  private inferIndustry(value: string) {
    const text = value.toLowerCase();
    if (text.includes('hospital') || text.includes('clinic') || text.includes('health')) return 'healthcare';
    if (text.includes('bank') || text.includes('finance') || text.includes('loan')) return 'banking';
    if (text.includes('insurance')) return 'insurance';
    if (text.includes('logistics') || text.includes('shipment') || text.includes('delivery')) return 'logistics';
    return 'general';
  }

  private buildSeedConfig(label: string, organizationName: string, industry: string) {
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

  private async seedDomainData(domainId: string, seed: { intents: string[]; rules: string[]; compliance: string[] }) {
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

  @Get()
  async list() {
    const items = await this.domainService.list();
    return {
      items: await Promise.all(items.map((item) => this.toLegacyDomain(item))),
    };
  }

  @Get(':domainCode')
  async getByCode(@Param('domainCode') domainCode: string) {
    const item = await this.domainService.getByCode(domainCode);
    return this.toLegacyDomain(item);
  }

  @Post('generate')
  async generate(
    @Body()
    payload: {
      domain_name: string;
      organization_name?: string;
    },
  ) {
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

  @Post()
  async create(@Body() payload: any) {
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

  @Put(':domainCode')
  async update(@Param('domainCode') domainCode: string, @Body() payload: any) {
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

  @Delete(':domainCode')
  async remove(@Param('domainCode') domainCode: string) {
    await this.domainService.deleteByCode(domainCode);
    return {
      deleted: true,
      domain_id: domainCode,
    };
  }
}
