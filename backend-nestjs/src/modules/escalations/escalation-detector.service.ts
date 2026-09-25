import { Injectable, Logger } from '@nestjs/common';
import type { EscalationPriority } from './escalation.entity';

export type EscalationTrigger = {
  shouldEscalate: boolean;
  reason: string;
  priority: EscalationPriority;
  skillGroup?: string;
  matchedRule: string;
};

type SessionSignals = {
  /** Consecutive turns where the assistant fell back / could not help. */
  fallbackStreak: number;
  /** Total turns in the conversation so far. */
  turnCount: number;
};

const NO_TRIGGER: EscalationTrigger = {
  shouldEscalate: false,
  reason: '',
  priority: 'normal',
  matchedRule: '',
};

/** Caller explicitly asking for a person. */
const HUMAN_REQUEST_PATTERNS = [
  /\b(speak|talk|connect|transfer|put me through)\b.{0,25}\b(human|person|agent|operator|representative|someone|somebody|staff)\b/i,
  /\b(human|live|real)\s+(agent|person|operator|representative)\b/i,
  /\b(customer\s+(care|service|support)|call\s+center)\b.{0,15}\b(agent|executive|person)?\b/i,
  /\boperator\b/i,
  /\bmanager\b/i,
];

/** Caller is frustrated — escalate before they hang up. */
const FRUSTRATION_PATTERNS = [
  /\b(this is (useless|ridiculous|frustrating)|not helping|you('| a)?re not helping)\b/i,
  /\b(i (already )?(told|said) you)\b/i,
  /\b(stupid|useless|worst|terrible)\s+(bot|system|service|ivr)\b/i,
  /\b(fed up|sick of this|waste of (my )?time)\b/i,
  /\b(complaint|complain|escalate)\b/i,
];

/** Life-safety or fraud — jump the queue. */
const URGENT_PATTERNS: { pattern: RegExp; reason: string; skillGroup: string }[] = [
  {
    pattern: /\b(chest pain|heart attack|stroke|not breathing|can'?t breathe|unconscious|bleeding heavily|suicid)\b/i,
    reason: 'Medical emergency reported by caller',
    skillGroup: 'emergency',
  },
  {
    pattern: /\b(fraud|unauthorized (transaction|charge)|card (stolen|lost)|account (hacked|compromised))\b/i,
    reason: 'Suspected fraud reported by caller',
    skillGroup: 'fraud',
  },
];

/**
 * Decides when a conversation should leave the IVR for a human.
 *
 * Runs on every caller utterance, so it is intentionally cheap: regex intent
 * matching plus two counters. The model can also request escalation explicitly
 * through the `escalate_to_human` tool, which bypasses this detector.
 */
@Injectable()
export class EscalationDetectorService {
  private readonly logger = new Logger(EscalationDetectorService.name);

  /** Escalate after this many consecutive unhandled turns. */
  private readonly maxFallbackStreak = 3;

  /** Escalate a conversation that never resolves, regardless of content. */
  private readonly maxTurns = 25;

  evaluate(utterance: string, signals: SessionSignals): EscalationTrigger {
    const text = (utterance || '').trim();

    if (text) {
      for (const { pattern, reason, skillGroup } of URGENT_PATTERNS) {
        if (pattern.test(text)) {
          return {
            shouldEscalate: true,
            reason,
            priority: 'urgent',
            skillGroup,
            matchedRule: 'urgent_keyword',
          };
        }
      }

      if (HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(text))) {
        return {
          shouldEscalate: true,
          reason: 'Caller asked to speak with a human agent',
          priority: 'high',
          matchedRule: 'human_request',
        };
      }

      if (FRUSTRATION_PATTERNS.some((pattern) => pattern.test(text))) {
        return {
          shouldEscalate: true,
          reason: 'Caller frustration detected',
          priority: 'high',
          matchedRule: 'frustration',
        };
      }
    }

    if (signals.fallbackStreak >= this.maxFallbackStreak) {
      return {
        shouldEscalate: true,
        reason: `IVR could not handle the request after ${signals.fallbackStreak} attempts`,
        priority: 'normal',
        matchedRule: 'fallback_streak',
      };
    }

    if (signals.turnCount >= this.maxTurns) {
      return {
        shouldEscalate: true,
        reason: `Conversation exceeded ${this.maxTurns} turns without resolution`,
        priority: 'normal',
        matchedRule: 'max_turns',
      };
    }

    return NO_TRIGGER;
  }

  /** True when an assistant reply is the configured fallback / "cannot help" text. */
  isFallbackReply(assistantText: string, fallbackMessage?: string): boolean {
    const text = (assistantText || '').trim().toLowerCase();
    if (!text) return false;

    if (fallbackMessage) {
      const fallback = fallbackMessage.trim().toLowerCase();
      if (fallback && (text.includes(fallback) || fallback.includes(text))) {
        return true;
      }
    }

    return /\b(i (can'?t|cannot|am not able to) help|outside .{0,20}scope|i (did not|didn'?t) (understand|catch)|sorry,? i)\b/i.test(
      text,
    );
  }
}
