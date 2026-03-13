from __future__ import annotations

import re
from dataclasses import dataclass

from .domains import DomainConfig


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


@dataclass(frozen=True)
class GuardDecision:
    in_scope: bool
    matched_intent: str | None
    reason: str


class IntentGuard:
    """
    Deterministic scope gate.
    If no intent match is found, treat request as out-of-scope (safe default).
    """

    def __init__(self, domain: DomainConfig):
        self.domain = domain
        self.intents = [i.strip().lower() for i in domain.intents if i.strip()]
        self.intent_keywords = self._build_keyword_map(self.intents, domain.industry.lower())

    def _build_keyword_map(self, intents: list[str], industry: str) -> dict[str, set[str]]:
        mapping: dict[str, set[str]] = {}
        for intent in intents:
            base = {intent}
            if "appointment" in intent:
                base |= {"book", "schedule", "reschedule", "slot", "doctor", "visit"}
            if "lab" in intent:
                base |= {"report", "test result", "blood test", "scan"}
            if "billing" in intent:
                base |= {"bill", "invoice", "payment", "charge", "refund"}
            if "operator" in intent:
                base |= {"agent", "human", "representative", "customer care", "help desk"}
            if industry == "healthcare":
                base |= {"hospital", "clinic", "patient"}
            mapping[intent] = base
        return mapping

    def out_of_scope_reply(self) -> str:
        options = ", ".join(self.intents[:-1]) + f", or {self.intents[-1]}" if len(self.intents) > 1 else (self.intents[0] if self.intents else "operator")
        return f"I can help only with {options}. Say operator."

    def decide(self, user_text: str) -> GuardDecision:
        normalized = _normalize(user_text)
        if not normalized:
            return GuardDecision(False, None, "empty_input")

        # Emergency terms are always routed to operator path.
        if re.search(r"\b(emergency|urgent|ambulance|chest pain|severe)\b", normalized):
            return GuardDecision(True, "operator", "emergency_route")

        for intent, keywords in self.intent_keywords.items():
            for kw in keywords:
                if kw in normalized:
                    return GuardDecision(True, intent, "keyword_match")

        return GuardDecision(False, None, "no_intent_match")
