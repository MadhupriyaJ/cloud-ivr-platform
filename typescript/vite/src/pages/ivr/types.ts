export type ServerMessage =
  | { type: 'output_audio'; audio: string }
  | { type: 'output_text'; text: string }
  | { type: 'output_text_done' }
  | { type: 'input_transcript'; text: string }
  | { type: 'escalated'; escalationId: string; status: string }
  | { type: 'escalation_failed'; text: string };

export type ClientMessage =
  | { type: 'input_audio'; audio: string }
  | { type: 'escalate'; reason?: string };

export type IvrStatus = 'idle' | 'connecting' | 'connected';

export type DomainConfig = {
  domain_uuid?: string;
  domain_id: string;
  display_name: string;
  industry: string;
  organization_name: string;
  voice: string;
  /** Language of the opening greeting. */
  language: string;
  /** Comma-separated languages callers may use, e.g. "English, Tamil". Empty = any language. */
  supported_languages?: string;
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

export type EscalationStatus =
  | 'pending'
  | 'queued'
  | 'assigned'
  | 'accepted'
  | 'resolved'
  | 'abandoned'
  | 'failed';

export type EscalationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type EscalationChannel = 'queue' | 'phone_transfer' | 'callback' | 'webhook';

export type Escalation = {
  escalationId: string;
  conversationId: string;
  domainId: string | null;
  escalationReason: string;
  status: EscalationStatus;
  priority: EscalationPriority;
  channel: EscalationChannel;
  queueName: string | null;
  skillGroup: string | null;
  callerIdentifier: string | null;
  callSid: string | null;
  transferTarget: string | null;
  contextSummary: string | null;
  resolutionNotes: string | null;
  escalatedAt: string;
  assignedAgentId: string | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
};

export type EscalationStats = {
  open: number;
  queued: number;
  assigned: number;
  accepted: number;
  resolvedToday: number;
  avgWaitSeconds: number;
  avgHandleSeconds: number;
};

/** Push payload from the agent-desk websocket (`/ws/agent-desk`). */
export type EscalationEvent = {
  type:
    | 'escalation.created'
    | 'escalation.assigned'
    | 'escalation.accepted'
    | 'escalation.closed'
    | 'escalation.requeued'
    | 'agent.presence'
    | 'connected'
    | 'ping';
  at: string;
  escalation?: Escalation;
  agent?: { agentId: string; name: string; availabilityStatus: string };
  message?: string;
};

export type AgentAvailability = 'available' | 'busy' | 'break' | 'offline';

export type Agent = {
  agentId: string;
  name: string;
  email: string;
  skillGroup: string | null;
  availabilityStatus: AgentAvailability;
  phoneNumber: string | null;
  activeEscalations: number;
  maxConcurrent: number;
  lastSeenAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/* ─── Telephony ─── */

export type PhoneNumberMapping = {
  phoneNumberId: string;
  phoneNumber: string;
  friendlyName: string | null;
  domainId: string;
  provider: string;
  escalationNumber: string | null;
  escalationSkillGroup: string | null;
  greetingOverride: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CallSession = {
  callId: string;
  callSid: string;
  conversationId: string | null;
  domainId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  direction: string;
  callStatus: string;
  escalationId: string | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  hangupCause: string | null;
};

export type TelephonyConfig = {
  provider: string;
  configured: boolean;
  signatureValidation: boolean;
  publicBaseUrl: string;
  callerId: string | null;
  fallbackAgentNumber: string | null;
  defaultDomain: string;
  webhooks: {
    incomingCall: string;
    statusCallback: string;
    mediaStream: string;
  };
  missing: string[];
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

export type HospitalDepartment = {
  departmentId: string;
  domainId: string;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HospitalDoctor = {
  doctorId: string;
  doctorCode?: string;
  doctorName: string;
  specialization?: string | null;
  availabilityStatus: string;
  consultationFee?: string | null;
  departmentId: string;
  departmentName: string;
  scheduleId?: string;
  scheduleDate?: string;
  startTime?: string;
  endTime?: string;
  availableSlots?: number;
};

export type HospitalSchedule = {
  scheduleId: string;
  doctorId: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  maxSlots: number;
  availableSlots: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type HospitalPatient = {
  patientId: string;
  patientCode: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  addressLine?: string | null;
  emergencyContact?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HospitalAppointment = {
  appointmentId: string;
  appointmentCode: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentStatus: string;
  reasonForVisit?: string | null;
  bookedChannel: string;
  patientId: string;
  patientCode: string;
  patientName: string;
  phoneNumber: string;
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
};

export type HospitalBilling = {
  billingId: string;
  patientId: string;
  appointmentId?: string | null;
  invoiceNumber: string;
  totalAmount: string;
  paidAmount: string;
  billingStatus: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HospitalLabReport = {
  labReportId: string;
  patientId: string;
  appointmentId?: string | null;
  reportNumber: string;
  testName: string;
  reportStatus: string;
  resultSummary?: string | null;
  reportDate?: string | null;
  createdAt: string;
  updatedAt: string;
};
