export type ServerMessage =
  | { type: 'output_audio'; audio: string }
  | { type: 'output_text'; text: string }
  | { type: 'output_text_done' };

export type ClientMessage = { type: 'input_audio'; audio: string };

export type IvrStatus = 'idle' | 'connecting' | 'connected';

export type DomainConfig = {
  domain_uuid?: string;
  domain_id: string;
  display_name: string;
  industry: string;
  organization_name: string;
  voice: string;
  language: string;
  welcome_message: string;
  fallback_message: string;
  intents: string[];
  rules: string[];
  compliance: string[];
  escalation_message: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DomainPayload = Omit<DomainConfig, 'created_at' | 'updated_at'>;

export type DomainIntent = {
  intentId: string;
  domainId: string;
  intentCode: string;
  intentLabel: string;
  description: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
};

export type DomainRule = {
  ruleId: string;
  domainId: string;
  ruleType: string;
  ruleText: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
};

export type Conversation = {
  conversationId: string;
  domainId: string;
  channelType: string;
  customerIdentifier: string | null;
  sessionStatus: string;
  currentIntent: string | null;
  startedAt: string;
  endedAt: string | null;
  escalatedToAgent: boolean;
  assignedAgentId: string | null;
  summaryText: string | null;
};

export type ConversationMessage = {
  messageId: string;
  conversationId: string;
  speakerType: string;
  messageType: string;
  messageText: string;
  sequenceNo: number;
  createdAt: string;
};

export type Escalation = {
  escalationId: string;
  conversationId: string;
  escalationReason: string;
  escalatedAt: string;
  assignedAgentId: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
};

export type Agent = {
  agentId: string;
  name: string;
  email: string;
  skillGroup: string | null;
  availabilityStatus: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromptTemplate = {
  promptTemplateId: string;
  domainId: string;
  promptType: string;
  templateText: string;
  versionNo: number;
  isActive: boolean;
  createdAt: string;
};

export type ToolDefinition = {
  toolId: string;
  domainId: string;
  toolName: string;
  description: string;
  schemaJson: string;
  handlerName: string;
  isActive: boolean;
  createdAt: string;
};
