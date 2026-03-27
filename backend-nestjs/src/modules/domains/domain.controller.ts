import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CacheService } from '../../common/cache.service';
import { DomainIntentsService } from '../domain-intents/domain-intents.service';
import { DomainRulesService } from '../domain-rules/domain-rules.service';
import { PromptTemplatesService } from '../prompt-templates/prompt-templates.service';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';

const CACHE_TTL = 60_000; // 60 seconds for domain list

@Controller('domains')
export class DomainController {
  constructor(
    private readonly domainService: DomainService,
    private readonly domainIntentsService: DomainIntentsService,
    private readonly domainRulesService: DomainRulesService,
    private readonly promptTemplatesService: PromptTemplatesService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Build the legacy domain response.
   * When allIntents/allRules maps are provided, uses them (batch mode).
   * Otherwise falls back to per-domain queries (single-domain mode).
   */
  private async toLegacyDomain(
    domain: any,
    allIntentsMap?: Map<string, any[]>,
    allRulesMap?: Map<string, any[]>,
  ) {
    let intents: any[];
    let rules: any[];

    if (allIntentsMap && allRulesMap) {
      intents = allIntentsMap.get(domain.domainId) || [];
      rules = allRulesMap.get(domain.domainId) || [];
    } else {
      [intents, rules] = await Promise.all([
        this.domainIntentsService.listByDomain(domain.domainId),
        this.domainRulesService.listByDomain(domain.domainId),
      ]);
    }

    return {
      domain_uuid: domain.domainId,
      domain_id: domain.domainCode,
      display_name: domain.displayName,
      industry: domain.industryType,
      organization_name: domain.organizationName,
      voice: domain.defaultVoice,
      language: domain.defaultLanguage,
      welcome_message: domain.welcomeMessage,
      fallback_message: domain.fallbackMessage,
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
        fallbackMessage:
          'I can help only with appointments, lab reports, billing, or operator support. Please say one of these options or say operator.',
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
        fallbackMessage:
          'I can help only with balance enquiry, card block, loan support, or operator requests. Please say one of these options or say operator.',
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
        fallbackMessage:
          'I can help only with policy status, claim status, premium enquiry, or operator support. Please say one of these options or say operator.',
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
        fallbackMessage:
          'I can help only with shipment tracking, delivery issues, invoice enquiries, or operator support. Please say one of these options or say operator.',
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
      fallbackMessage:
        'I can help only with sales, support, billing, or operator requests. Please say one of these options or say operator.',
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

  private buildDefaultSystemPrompt(organizationName: string) {
    return `You are the IVR assistant for ${organizationName}. Handle only the configured business intents, follow the active domain rules and compliance instructions, and use the saved fallback or escalation response when the request is unsupported.`;
  }

  private async syncPromptTemplates(domainId: string, payload: {
    organizationName: string;
    welcomeMessage: string;
    fallbackMessage: string;
    escalationMessage: string;
  }) {
    await Promise.all([
      this.promptTemplatesService.upsertActiveTemplate(domainId, {
        promptType: 'welcome',
        templateText: payload.welcomeMessage,
        versionNo: 1,
        isActive: true,
      }),
      this.promptTemplatesService.upsertActiveTemplate(domainId, {
        promptType: 'fallback',
        templateText: payload.fallbackMessage,
        versionNo: 1,
        isActive: true,
      }),
      this.promptTemplatesService.upsertActiveTemplate(domainId, {
        promptType: 'escalation',
        templateText: payload.escalationMessage,
        versionNo: 1,
        isActive: true,
      }),
      this.promptTemplatesService.upsertActiveTemplate(domainId, {
        promptType: 'system',
        templateText: this.buildDefaultSystemPrompt(payload.organizationName),
        versionNo: 1,
        isActive: true,
      }),
    ]);
  }

  /**
   * OPTIMIZED: Uses cache + batch loading (3 parallel queries instead of N+1).
   * First call: ~3 queries × 1.6s = ~4.8s (parallel → ~1.6s)
   * Subsequent calls within 60s: ~0ms (from cache)
   */
  @Get()
  async list() {
    return this.cache.getOrSet('domains:list', async () => {
      // Load all data in 3 parallel queries instead of 1 + 2N sequential queries
      const [items, allIntents, allRules] = await Promise.all([
        this.domainService.list(),
        this.domainIntentsService.listAll(),
        this.domainRulesService.listAll(),
      ]);

      // Build lookup maps by domainId
      const intentsMap = new Map<string, any[]>();
      const rulesMap = new Map<string, any[]>();

      for (const intent of allIntents) {
        const domainId = intent.domainId;
        if (!intentsMap.has(domainId)) intentsMap.set(domainId, []);
        intentsMap.get(domainId)!.push(intent);
      }

      for (const rule of allRules) {
        const domainId = rule.domainId;
        if (!rulesMap.has(domainId)) rulesMap.set(domainId, []);
        rulesMap.get(domainId)!.push(rule);
      }

      return {
        items: await Promise.all(items.map((item) => this.toLegacyDomain(item, intentsMap, rulesMap))),
      };
    }, CACHE_TTL);
  }

  @Get(':domainCode')
  async getByCode(@Param('domainCode') domainCode: string) {
    return this.cache.getOrSet(`domains:${domainCode}`, async () => {
      const item = await this.domainService.getByCode(domainCode);
      return this.toLegacyDomain(item);
    }, CACHE_TTL);
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
      fallbackMessage: seed.fallbackMessage,
      escalationMessage: seed.escalationMessage,
      isActive: true,
    });

    await this.seedDomainData(created.domainId, seed);
    await this.syncPromptTemplates(created.domainId, {
      organizationName,
      welcomeMessage: created.welcomeMessage,
      fallbackMessage: created.fallbackMessage,
      escalationMessage: created.escalationMessage,
    });

    this.cache.invalidatePrefix('domains:');
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
      fallbackMessage:
        payload.fallbackMessage ??
        payload.fallback_message ??
        this.buildSeedConfig(
          payload.displayName ?? payload.display_name ?? payload.domainCode ?? payload.domain_id ?? 'General Support',
          payload.organizationName ?? payload.organization_name ?? 'General Support',
          payload.industryType ?? payload.industry ?? 'general',
        ).fallbackMessage,
      escalationMessage: payload.escalationMessage ?? payload.escalation_message,
      isActive: payload.isActive ?? payload.active,
    });
    await this.syncPromptTemplates(created.domainId, {
      organizationName: created.organizationName,
      welcomeMessage: created.welcomeMessage,
      fallbackMessage: created.fallbackMessage,
      escalationMessage: created.escalationMessage,
    });

    this.cache.invalidatePrefix('domains:');
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
      fallbackMessage:
        payload.fallbackMessage ??
        payload.fallback_message ??
        this.buildSeedConfig(
          payload.displayName ?? payload.display_name ?? domainCode,
          payload.organizationName ?? payload.organization_name ?? 'General Support',
          payload.industryType ?? payload.industry ?? 'general',
        ).fallbackMessage,
      escalationMessage: payload.escalationMessage ?? payload.escalation_message,
      isActive: payload.isActive ?? payload.active,
    });
    await this.syncPromptTemplates(updated.domainId, {
      organizationName: updated.organizationName,
      welcomeMessage: updated.welcomeMessage,
      fallbackMessage: updated.fallbackMessage,
      escalationMessage: updated.escalationMessage,
    });

    this.cache.invalidatePrefix('domains:');
    return this.toLegacyDomain(updated);
  }

  @Delete(':domainCode')
  async remove(@Param('domainCode') domainCode: string) {
    await this.domainService.deleteByCode(domainCode);
    this.cache.invalidatePrefix('domains:');
    return {
      deleted: true,
      domain_id: domainCode,
    };
  }
}
