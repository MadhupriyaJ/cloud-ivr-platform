"""
AI-Powered Intent Guard
========================
Replaces the keyword-based IntentGuard with Gen AI classification.
Uses the OpenAI API to classify caller intent against the domain's
allowed intents, providing more accurate and flexible intent matching.

Falls back to keyword matching if AI classification is unavailable.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any

from .domains import DomainConfig

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GuardDecision:
    in_scope: bool
    matched_intent: str | None
    reason: str
    confidence: float = 1.0


class AIIntentGuard:
    """
    AI-powered intent classification gate.

    Uses Gen AI (via OpenAI-compatible API) to classify whether a caller's
    utterance matches one of the domain's allowed intents.

    Falls back to keyword matching if:
    - No API key is configured
    - AI call fails or times out
    - Response is unparseable
    """

    def __init__(self, domain: DomainConfig, use_ai: bool = True):
        self.domain = domain
        self.intents = [i.strip().lower() for i in domain.intents if i.strip()]
        self.use_ai = use_ai and bool(os.getenv("OPENAI_API_KEY"))
        self._keyword_map = self._build_keyword_map()

    def _build_keyword_map(self) -> dict[str, set[str]]:
        """Build keyword map for fallback matching."""
        mapping: dict[str, set[str]] = {}
        industry = self.domain.industry.lower()
        for intent in self.intents:
            base = {intent}
            # Add common synonyms
            if "appointment" in intent:
                base |= {"book", "schedule", "reschedule", "slot", "doctor", "visit"}
            if "lab" in intent:
                base |= {"report", "test result", "blood test", "scan"}
            if "billing" in intent or "bill" in intent:
                base |= {"bill", "invoice", "payment", "charge", "refund"}
            if "operator" in intent:
                base |= {"agent", "human", "representative", "customer care", "help desk", "transfer"}
            if "balance" in intent:
                base |= {"balance", "account", "savings", "current"}
            if "card" in intent or "block" in intent:
                base |= {"card", "block", "lost", "stolen", "debit", "credit"}
            if "loan" in intent:
                base |= {"loan", "emi", "interest", "principal"}
            if "track" in intent or "shipment" in intent:
                base |= {"track", "shipment", "delivery", "courier", "parcel"}
            if "policy" in intent:
                base |= {"policy", "coverage", "insured", "premium"}
            if "claim" in intent:
                base |= {"claim", "reimbursement", "settlement"}
            if industry == "healthcare":
                base |= {"hospital", "clinic", "patient"}
            if industry == "banking":
                base |= {"bank", "account", "transaction"}
            mapping[intent] = base
        return mapping

    def out_of_scope_reply(self) -> str:
        if len(self.intents) > 1:
            options = ", ".join(self.intents[:-1]) + f", or {self.intents[-1]}"
        elif self.intents:
            options = self.intents[0]
        else:
            options = "operator"
        return f"I can help only with {options}. Say operator."

    def decide(self, user_text: str) -> GuardDecision:
        """
        Classify user intent. Uses AI when available, falls back to keywords.
        """
        normalized = self._normalize(user_text)
        if not normalized:
            return GuardDecision(False, None, "empty_input")

        # Emergency terms always route through
        if re.search(r"\b(emergency|urgent|ambulance|chest pain|severe|critical)\b", normalized):
            return GuardDecision(True, "operator", "emergency_route", 1.0)

        # Try AI classification first
        if self.use_ai:
            try:
                ai_decision = self._classify_with_ai(user_text)
                if ai_decision is not None:
                    return ai_decision
            except Exception as exc:
                logger.warning(f"AI intent classification failed, falling back to keywords: {exc}")

        # Fallback to keyword matching
        return self._keyword_classify(normalized)

    def _classify_with_ai(self, user_text: str) -> GuardDecision | None:
        """Use Gen AI to classify intent."""
        try:
            from openai import OpenAI
            client = OpenAI()

            intents_list = ", ".join(self.intents)
            prompt = (
                f"You are an intent classifier for a {self.domain.industry} IVR system "
                f"at {self.domain.organization_name}.\n\n"
                f"Allowed intents: [{intents_list}]\n\n"
                f"Caller said: \"{user_text}\"\n\n"
                f"Classify this utterance. Respond with JSON only:\n"
                f'{{"in_scope": true/false, "intent": "matched_intent_or_null", "confidence": 0.0-1.0}}\n\n'
                f"If the utterance matches any allowed intent, set in_scope=true and intent to the matching intent name. "
                f"If it does not match any intent, set in_scope=false and intent=null."
            )

            response = client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=100,
            )

            content = response.choices[0].message.content.strip()
            # Parse JSON from response
            json_match = re.search(r'\{[^}]+\}', content)
            if json_match:
                result = json.loads(json_match.group())
                in_scope = result.get("in_scope", False)
                intent = result.get("intent")
                confidence = float(result.get("confidence", 0.5))

                if in_scope and intent:
                    return GuardDecision(True, intent.lower(), "ai_classification", confidence)
                else:
                    return GuardDecision(False, None, "ai_out_of_scope", confidence)

        except ImportError:
            logger.debug("OpenAI package not available for AI intent classification.")
        except Exception as exc:
            logger.warning(f"AI classification error: {exc}")

        return None

    def _keyword_classify(self, normalized: str) -> GuardDecision:
        """Fallback keyword-based classification."""
        for intent, keywords in self._keyword_map.items():
            for kw in keywords:
                if kw in normalized:
                    return GuardDecision(True, intent, "keyword_match")
        return GuardDecision(False, None, "no_intent_match")

    @staticmethod
    def _normalize(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text
