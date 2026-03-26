"""
Base Domain Adapter
===================
Abstract interface that every domain adapter must implement.
Adapters translate IVR intents into domain-specific API calls,
handle authentication, and normalize responses.

Design Principles:
- Each adapter is self-contained and stateless per request.
- Adapters declare their own tool definitions (OpenAI function-calling schema).
- Adapters handle their own authentication with the core system.
- Adapters normalize all responses into a standard AdapterResponse.
- Retry and circuit-breaker logic is handled by the integration router,
  not inside individual adapters.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AdapterStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    PARTIAL = "partial"
    UNAUTHORIZED = "unauthorized"
    TIMEOUT = "timeout"
    NOT_FOUND = "not_found"
    ESCALATE = "escalate"


@dataclass
class AdapterResponse:
    """Normalized response from any domain adapter."""

    ok: bool
    status: AdapterStatus
    data: dict[str, Any] = field(default_factory=dict)
    message: str = ""
    error: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "status": self.status.value,
            "data": self.data,
            "message": self.message,
            "error": self.error,
            "metadata": self.metadata,
        }


@dataclass
class AdapterToolDefinition:
    """
    Describes a single tool (function) that the adapter exposes to the AI model.
    Maps directly to OpenAI function-calling schema.
    """

    name: str
    description: str
    parameters: dict[str, Any]
    handler_method: str  # method name on the adapter class

    def to_openai_tool(self) -> dict:
        """Convert to OpenAI Realtime API tool format."""
        return {
            "type": "function",
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


@dataclass
class AdapterConfig:
    """
    Configuration for a domain adapter instance.
    Loaded from domain config JSON/YAML or database.
    """

    domain_id: str
    adapter_type: str  # e.g., "hospital", "banking", "insurance", "generic"
    organization_name: str
    api_base_url: str = ""
    api_key: str = ""
    auth_type: str = "none"  # none, api_key, oauth2, basic
    auth_config: dict[str, Any] = field(default_factory=dict)
    custom_settings: dict[str, Any] = field(default_factory=dict)
    timeout_seconds: int = 30
    max_retries: int = 3


class BaseDomainAdapter(ABC):
    """
    Abstract base class for all domain adapters.

    Every domain adapter (Hospital, Banking, Insurance, etc.) must:
    1. Declare its tool definitions via get_tool_definitions()
    2. Implement execute_tool() to handle tool calls from the AI model
    3. Implement health_check() for monitoring
    4. Optionally implement authenticate() for core system auth

    Usage:
        adapter = HospitalAdapter(config)
        tools = adapter.get_tool_definitions()
        result = adapter.execute_tool("book_appointment", {...})
    """

    def __init__(self, config: AdapterConfig):
        self.config = config
        self._authenticated = False
        self._auth_token: str | None = None
        self._auth_expiry: float = 0

    @property
    def domain_id(self) -> str:
        return self.config.domain_id

    @property
    def adapter_type(self) -> str:
        return self.config.adapter_type

    @abstractmethod
    def get_tool_definitions(self) -> list[AdapterToolDefinition]:
        """
        Return the list of tools this adapter exposes.
        These are registered with the OpenAI Realtime session.
        """
        ...

    @abstractmethod
    def execute_tool(self, tool_name: str, args: dict[str, Any]) -> AdapterResponse:
        """
        Execute a tool call from the AI model.
        Route to the appropriate handler method based on tool_name.
        """
        ...

    @abstractmethod
    def health_check(self) -> AdapterResponse:
        """
        Check connectivity to the core system.
        Used for monitoring and circuit-breaker decisions.
        """
        ...

    def authenticate(self) -> bool:
        """
        Authenticate with the core system.
        Override in adapters that need auth (OAuth2, API key validation, etc.).
        Default implementation marks as authenticated (no-auth domains).
        """
        self._authenticated = True
        return True

    def is_authenticated(self) -> bool:
        if self.config.auth_type == "none":
            return True
        if not self._authenticated:
            return False
        if self._auth_expiry > 0 and time.time() > self._auth_expiry:
            return False
        return True

    def ensure_authenticated(self) -> None:
        """Re-authenticate if token expired or not yet authenticated."""
        if not self.is_authenticated():
            self.authenticate()

    def get_openai_tools(self) -> list[dict]:
        """Get tool definitions in OpenAI function-calling format."""
        return [tool.to_openai_tool() for tool in self.get_tool_definitions()]

    def _dispatch_tool(self, tool_name: str, args: dict[str, Any]) -> AdapterResponse:
        """
        Internal dispatcher that maps tool_name to handler method.
        Subclasses can use this in their execute_tool() implementation.
        """
        for tool_def in self.get_tool_definitions():
            if tool_def.name == tool_name:
                handler = getattr(self, tool_def.handler_method, None)
                if handler:
                    return handler(**args)
                return AdapterResponse(
                    ok=False,
                    status=AdapterStatus.ERROR,
                    error=f"Handler method '{tool_def.handler_method}' not found on adapter.",
                )
        return AdapterResponse(
            ok=False,
            status=AdapterStatus.NOT_FOUND,
            error=f"Unknown tool: {tool_name}",
        )
