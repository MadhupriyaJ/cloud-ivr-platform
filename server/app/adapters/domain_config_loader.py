"""
Domain Configuration Loader
============================
Loads domain adapter configurations from JSON/YAML files or database.
Supports configuration-driven IVR where domain behavior is defined
in config files rather than hardcoded.

Configuration Structure:
{
    "domain_id": "hospital",
    "adapter_type": "hospital",
    "organization_name": "Meenakshi Mission Hospital",
    "api_base_url": "https://hms.meenakshi.org/api",
    "auth_type": "oauth2",
    "auth_config": { ... },
    "intents": {
        "book_appointment": {
            "adapter": "hospital",
            "action": "book_appointment",
            "description": "Book a doctor appointment"
        }
    },
    "custom_settings": { ... }
}
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from .base_adapter import AdapterConfig

logger = logging.getLogger(__name__)


# ── Default Domain Adapter Configs ─────────────────────────────────

DEFAULT_ADAPTER_CONFIGS: dict[str, dict[str, Any]] = {
    "hospital": {
        "adapter_type": "hospital",
        "auth_type": "none",
        "timeout_seconds": 30,
        "max_retries": 3,
        "custom_settings": {},
    },
    "banking": {
        "adapter_type": "banking",
        "auth_type": "none",
        "timeout_seconds": 15,
        "max_retries": 2,
        "custom_settings": {},
    },
    "insurance": {
        "adapter_type": "insurance",
        "auth_type": "none",
        "timeout_seconds": 30,
        "max_retries": 3,
        "custom_settings": {},
    },
    "logistics": {
        "adapter_type": "logistics",
        "auth_type": "none",
        "timeout_seconds": 20,
        "max_retries": 3,
        "custom_settings": {},
    },
}

# ── Industry to Adapter Type Mapping ───────────────────────────────

INDUSTRY_ADAPTER_MAP: dict[str, str] = {
    "healthcare": "hospital",
    "hospital": "hospital",
    "clinic": "hospital",
    "medical": "hospital",
    "banking": "banking",
    "finance": "banking",
    "fintech": "banking",
    "insurance": "insurance",
    "logistics": "logistics",
    "shipping": "logistics",
    "courier": "logistics",
    "ecommerce": "generic",
    "retail": "generic",
    "telecom": "generic",
    "education": "generic",
    "government": "generic",
    "general": "generic",
}


def infer_adapter_type(industry: str, domain_id: str = "") -> str:
    """
    Infer the adapter type from industry or domain_id.
    Uses Gen AI-friendly fuzzy matching rather than exact match.
    """
    industry_lower = industry.strip().lower()
    domain_lower = domain_id.strip().lower()

    # Direct match on industry
    if industry_lower in INDUSTRY_ADAPTER_MAP:
        return INDUSTRY_ADAPTER_MAP[industry_lower]

    # Check if industry contains known keywords
    for keyword, adapter_type in INDUSTRY_ADAPTER_MAP.items():
        if keyword in industry_lower or keyword in domain_lower:
            return adapter_type

    return "generic"


def load_adapter_config_from_domain(
    domain_id: str,
    industry: str,
    organization_name: str,
    override_config: dict[str, Any] | None = None,
) -> AdapterConfig:
    """
    Build an AdapterConfig from domain metadata.
    Merges defaults with any override config from the domain's adapter_config field.
    """
    adapter_type = infer_adapter_type(industry, domain_id)
    defaults = DEFAULT_ADAPTER_CONFIGS.get(adapter_type, {})

    # Merge with overrides
    merged = {**defaults}
    if override_config:
        merged.update(override_config)

    return AdapterConfig(
        domain_id=domain_id,
        adapter_type=merged.get("adapter_type", adapter_type),
        organization_name=organization_name,
        api_base_url=merged.get("api_base_url", ""),
        api_key=merged.get("api_key", ""),
        auth_type=merged.get("auth_type", "none"),
        auth_config=merged.get("auth_config", {}),
        custom_settings=merged.get("custom_settings", {}),
        timeout_seconds=merged.get("timeout_seconds", 30),
        max_retries=merged.get("max_retries", 3),
    )


def load_adapter_config_from_file(config_path: Path) -> AdapterConfig:
    """Load adapter config from a JSON file."""
    if not config_path.exists():
        raise FileNotFoundError(f"Adapter config file not found: {config_path}")

    raw = json.loads(config_path.read_text(encoding="utf-8"))
    return AdapterConfig(
        domain_id=raw["domain_id"],
        adapter_type=raw["adapter_type"],
        organization_name=raw.get("organization_name", ""),
        api_base_url=raw.get("api_base_url", ""),
        api_key=raw.get("api_key", ""),
        auth_type=raw.get("auth_type", "none"),
        auth_config=raw.get("auth_config", {}),
        custom_settings=raw.get("custom_settings", {}),
        timeout_seconds=raw.get("timeout_seconds", 30),
        max_retries=raw.get("max_retries", 3),
    )


def load_all_adapter_configs(config_dir: Path) -> dict[str, AdapterConfig]:
    """Load all adapter config files from a directory."""
    configs: dict[str, AdapterConfig] = {}
    if not config_dir.exists():
        return configs

    for config_file in sorted(config_dir.glob("*.json")):
        try:
            config = load_adapter_config_from_file(config_file)
            configs[config.domain_id] = config
            logger.info(f"Loaded adapter config: {config.domain_id} ({config.adapter_type})")
        except Exception as exc:
            logger.warning(f"Failed to load adapter config from {config_file}: {exc}")

    return configs


class DomainIntentMapping:
    """
    Maps domain intents to adapter actions.
    Loaded from domain config, supports dynamic intent routing.

    Example config:
    {
        "intents": {
            "book_appointment": {
                "adapter": "hospital",
                "action": "book_appointment",
                "description": "Book a doctor appointment",
                "required_fields": ["patient_name", "phone_number", "visit_date"]
            }
        }
    }
    """

    def __init__(self, intent_config: dict[str, Any] | None = None):
        self._mappings: dict[str, dict[str, Any]] = intent_config or {}

    def get_action_for_intent(self, intent: str) -> dict[str, Any] | None:
        """Get the adapter action mapping for an intent."""
        return self._mappings.get(intent.lower().strip())

    def get_adapter_type_for_intent(self, intent: str) -> str | None:
        """Get which adapter handles a given intent."""
        mapping = self.get_action_for_intent(intent)
        return mapping.get("adapter") if mapping else None

    def list_intents(self) -> list[str]:
        """List all configured intents."""
        return list(self._mappings.keys())

    def to_dict(self) -> dict:
        return self._mappings
