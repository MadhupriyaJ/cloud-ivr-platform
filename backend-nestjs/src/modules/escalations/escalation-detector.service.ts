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

/*
 * Callers speak English, Tamil (in Tamil script or romanised "Tanglish"),
 * Hindi and mixes of these. Note that `\b` only understands ASCII letters, so
 * patterns for Tamil/Devanagari script must not rely on word boundaries.
 * The model's escalate_to_human tool is the main multilingual path; these
 * patterns are the cheap safety net that does not depend on the model.
 */

/** Caller explicitly asking for a person. */
const HUMAN_REQUEST_PATTERNS = [
  /\b(speak|talk|connect|transfer|put me through)\b.{0,25}\b(human|person|agent|operator|representative|someone|somebody|staff)\b/i,
  /\b(human|live|real)\s+(agent|person|operator|representative)\b/i,
  /\b(customer\s+(care|service|support)|call\s+center)\b.{0,15}\b(agent|executive|person)?\b/i,
  /\boperator\b/i,
  /\bmanager\b/i,
  // Tanglish: "agent kitta pesanum", "oru aal kooda pesanum"
  /\b(agent|operator|staff|person|human|aal|aalu|manushan|manusan)\s*(kitta|kooda|kuda|kita)\s*(pesa|pesanum|pesu|peshanum|connect)/i,
  // Tamil script: "ஏஜென்ட் கிட்ட பேசணும்", "ஆள் கிட்ட பேச"
  /(ஏஜென்ட்|ஆள்|ஆளு|மனுஷ|மனித|ஆபரேட்டர்|ஸ்டாஃப்)[^.?!]{0,20}(பேச|கனெக்ட்)/,
  // Hindi: "kisi insaan se baat", "एजेंट से बात"
  /(इंसान|एजेंट|ऑपरेटर|किसी व्यक्ति)[^.?!]{0,15}बात/,
  /\b(insaan|agent|operator)\s+se\s+baat\b/i,
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
    // Tamil script. Deliberately not bare "ரத்தம்" (blood): "ரத்த பரிசோதனை"
    // is a routine blood-test enquiry, not an emergency.
    pattern:
      /(நெஞ்சு\s?வலி|நெஞ்சுவலி|மாரடைப்பு|ஹார்ட்\s?அட்டாக்|மூச்சு\s?(விட|திணற)|மூச்சுத்\s?திணறல்|மயக்கம்|பக்கவாதம்|தற்கொலை|ரத்தம்\s?(நிக்க|நிற்க|கொட்டு)|இரத்தம்\s?(நிக்க|நிற்க|கொட்டு))/,
    reason: 'Medical emergency reported by caller',
    skillGroup: 'emergency',
  },
  {
    // Romanised Tamil and Hindi
    pattern:
      /\b(nenju\s?vali|nenjuvali|moochu\s?(vida|thinaral)|mayakkam|seene\s+(me|mein)\s+dard|saans\s+nahi)\b/i,
    reason: 'Medical emergency reported by caller',
    skillGroup: 'emergency',
  },
  {
    // Hindi (Devanagari)
    pattern: /(सीने में दर्द|दिल का दौरा|सांस नहीं|बेहोश)/,
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

    if (
      /\b(i (can'?t|cannot|am not able to) help|outside .{0,20}scope|i (did not|didn'?t) (understand|catch)|sorry,? i)\b/i.test(
        text,
      )
    ) {
      return true;
    }

    // The assistant now says the fallback in the caller's language, so the
    // English fallback text above no longer matches a Tamil/Hindi reply.
    return /(புரியவில்லை|புரியல|உதவ முடியாது|உதவ முடியல|samajh nahi|समझ नहीं|मदद नहीं कर)/i.test(text);
  }
}
