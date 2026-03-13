from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _slugify(value: str) -> str:
    compact = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return compact or "general"

@dataclass
class DomainConfig:
    domain_id: str
    display_name: str
    industry: str
    organization_name: str
    voice: str = "alloy"
    language: str = "English"
    welcome_message: str = "Welcome. How can I help you today?"
    intents: list[str] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)
    compliance: list[str] = field(default_factory=list)
    escalation_message: str = "Connecting you to an operator."
    active: bool = True
    created_at: str = field(default_factory=_utc_now)
    updated_at: str = field(default_factory=_utc_now)

    @classmethod
    def from_dict(cls, payload: dict) -> "DomainConfig":
        return cls(
            domain_id=str(payload["domain_id"]),
            display_name=str(payload.get("display_name") or payload["domain_id"]),
            industry=str(payload.get("industry") or "general"),
            organization_name=str(payload.get("organization_name") or "Support Desk"),
            voice=str(payload.get("voice") or "alloy"),
            language=str(payload.get("language") or "English"),
            welcome_message=str(payload.get("welcome_message") or "Welcome. How can I help you today?"),
            intents=[str(item) for item in payload.get("intents", [])],
            rules=[str(item) for item in payload.get("rules", [])],
            compliance=[str(item) for item in payload.get("compliance", [])],
            escalation_message=str(payload.get("escalation_message") or "Connecting you to an operator."),
            active=bool(payload.get("active", True)),
            created_at=str(payload.get("created_at") or _utc_now()),
            updated_at=str(payload.get("updated_at") or _utc_now()),
        )

    def to_dict(self) -> dict:
        return asdict(self)


class DomainRegistry:
    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
        self._lock = Lock()
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.storage_path.exists():
            defaults = [
                DomainConfig(
                    domain_id="hospital",
                    display_name="Hospital Management",
                    industry="healthcare",
                    organization_name="City Care Hospital",
                    welcome_message="Welcome to City Care Hospital. How may I help you?",
                    intents=["appointments", "lab reports", "billing", "operator"],
                    rules=[
                        "Keep responses short and suitable for phone calls.",
                        "Ask only one routing question at a time.",
                        "If caller is unclear, repeat available options.",
                    ],
                    compliance=["Do not expose patient details without verification."],
                    escalation_message="Let me transfer you to the hospital operator.",
                )
            ]
            self._write(defaults)

    def _read(self) -> list[DomainConfig]:
        with self._lock:
            raw = json.loads(self.storage_path.read_text(encoding="utf-8"))
        return [DomainConfig.from_dict(item) for item in raw]

    def _write(self, items: list[DomainConfig]) -> None:
        with self._lock:
            self.storage_path.write_text(
                json.dumps([item.to_dict() for item in items], indent=2),
                encoding="utf-8",
            )

    def list_domains(self) -> list[DomainConfig]:
        return sorted(self._read(), key=lambda item: item.updated_at, reverse=True)

    def get_domain(self, domain_id: str) -> DomainConfig | None:
        domain_id = domain_id.strip().lower()
        for item in self._read():
            if item.domain_id == domain_id:
                return item
        return None

    def upsert_domain(self, payload: DomainConfig) -> DomainConfig:
        payload.domain_id = _slugify(payload.domain_id)
        now = _utc_now()
        payload.updated_at = now

        items = self._read()
        replaced = False
        for index, item in enumerate(items):
            if item.domain_id == payload.domain_id:
                payload.created_at = item.created_at
                items[index] = payload
                replaced = True
                break

        if not replaced:
            payload.created_at = now
            items.append(payload)

        self._write(items)
        return payload

    def delete_domain(self, domain_id: str) -> bool:
        domain_id = domain_id.strip().lower()
        items = self._read()
        filtered = [item for item in items if item.domain_id != domain_id]
        if len(filtered) == len(items):
            return False
        self._write(filtered)
        return True

    def generate_domain(self, domain_name: str, organization_name: str | None = None) -> DomainConfig:
        label = domain_name.strip() or "General Support"
        slug = _slugify(label)
        lower = label.lower()
        org = organization_name.strip() if organization_name else f"{label} Support"

        if "hospital" in lower or "clinic" in lower or "health" in lower:
            template = DomainConfig(
                domain_id=slug,
                display_name=f"{label} IVR",
                industry="healthcare",
                organization_name=org,
                welcome_message=f"Welcome to {org}. Please tell me how I can help.",
                intents=["appointments", "lab reports", "billing", "operator"],
                rules=[
                    "Keep responses under 12 words when possible.",
                    "Use calm and polite spoken English.",
                    "If caller sounds urgent, prioritize emergency guidance.",
                ],
                compliance=["Never expose patient details before verification."],
                escalation_message="I will transfer your call to a hospital operator.",
            )
        elif "bank" in lower or "finance" in lower or "loan" in lower:
            template = DomainConfig(
                domain_id=slug,
                display_name=f"{label} IVR",
                industry="banking",
                organization_name=org,
                welcome_message=f"Welcome to {org}. How can I assist you today?",
                intents=["balance enquiry", "card block", "loan support", "operator"],
                rules=[
                    "Confirm caller intent before giving sensitive actions.",
                    "Ask one short question at a time.",
                    "Keep replies concise for voice call flow.",
                ],
                compliance=["Always request verification before account-specific answers."],
                escalation_message="Please hold while I connect you to banking support.",
            )
        else:
            template = DomainConfig(
                domain_id=slug,
                display_name=f"{label} IVR",
                industry="general",
                organization_name=org,
                welcome_message=f"Welcome to {org}. Please tell me your request.",
                intents=["sales", "support", "billing", "operator"],
                rules=[
                    "Speak clearly and keep responses short.",
                    "Do not ask multiple questions in one turn.",
                ],
                compliance=["Avoid sharing confidential information without verification."],
                escalation_message="I can transfer you to a live support agent.",
            )

        return self.upsert_domain(template)
