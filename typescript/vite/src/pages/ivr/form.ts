import type { DomainConfig, DomainPayload } from './types';

export const EMPTY_DOMAIN: DomainPayload = {
  domain_id: '',
  display_name: '',
  industry: '',
  organization_name: '',
  voice: 'alloy',
  language: 'English',
  welcome_message: '',
  intents: [],
  rules: [],
  compliance: [],
  escalation_message: 'Connecting you to an operator.',
  active: true
};

export const toLines = (items: string[]): string => items.join('\n');

export const fromLines = (raw: string): string[] =>
  raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

export const toPayload = (domain: DomainConfig): DomainPayload => ({
  domain_id: domain.domain_id,
  display_name: domain.display_name,
  industry: domain.industry,
  organization_name: domain.organization_name,
  voice: domain.voice,
  language: domain.language,
  welcome_message: domain.welcome_message,
  intents: domain.intents,
  rules: domain.rules,
  compliance: domain.compliance,
  escalation_message: domain.escalation_message,
  active: domain.active
});
