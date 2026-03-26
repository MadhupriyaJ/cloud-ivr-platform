"""
Generic Domain Adapter
======================
Fallback adapter for domains that don't have a specialized adapter.
Uses Gen AI to dynamically handle intents by forwarding requests
to a configurable webhook or returning conversational responses.

This adapter supports:
1. Webhook mode: Forwards tool calls to a configured webhook URL
2. Conversational mode: Returns helpful responses without backend integration
3. Custom tool mode: Loads tool definitions from domain config JSON
"""

from __future__ import annotations

import json
import logging
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .base_adapter import (
    AdapterConfig,
    AdapterResponse,
    AdapterStatus,
    AdapterToolDefinition,
    BaseDomainAdapter,
)

logger = logging.getLogger(__name__)


class GenericAdapter(BaseDomainAdapter):
    """
    Generic fallback adapter that works for any domain.

    Can be configured with:
    - custom_settings.webhook_url: Forward all tool calls to this URL
    - custom_settings.custom_tools: List of custom tool definitions
    - custom_settings.mode: "webhook", "conversational", or "custom"

    Default tools:
    - lookup_info: General information lookup
    - create_ticket: Create a support ticket
    - check_status: Check status of a request
    - escalate_to_agent: Transfer to human agent
    """

    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        self._mode = config.custom_settings.get("mode", "conversational")
        self._webhook_url = config.custom_settings.get("webhook_url", "")
        self._custom_tools_raw = config.custom_settings.get("custom_tools", [])

    def get_tool_definitions(self) -> list[AdapterToolDefinition]:
        # If custom tools are defined in config, use those
        if self._custom_tools_raw:
            return self._parse_custom_tools()

        # Default generic tools
        return [
            AdapterToolDefinition(
                name="lookup_info",
                description="Look up information based on caller's query. Use for general inquiries.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The information the caller is looking for"},
                        "category": {"type": "string", "description": "Category: sales, support, billing, general"},
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
                handler_method="handle_lookup_info",
            ),
            AdapterToolDefinition(
                name="create_ticket",
                description="Create a support or service ticket for the caller.",
                parameters={
                    "type": "object",
                    "properties": {
                        "caller_name": {"type": "string"},
                        "phone_number": {"type": "string"},
                        "issue_description": {"type": "string"},
                        "priority": {"type": "string", "description": "low, medium, high, urgent"},
                        "category": {"type": "string"},
                    },
                    "required": ["phone_number", "issue_description"],
                    "additionalProperties": False,
                },
                handler_method="handle_create_ticket",
            ),
            AdapterToolDefinition(
                name="check_status",
                description="Check the status of a previously created request or ticket.",
                parameters={
                    "type": "object",
                    "properties": {
                        "ticket_id": {"type": "string"},
                        "phone_number": {"type": "string"},
                        "reference_number": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
                handler_method="handle_check_status",
            ),
            AdapterToolDefinition(
                name="escalate_to_agent",
                description="Transfer the call to a human agent.",
                parameters={
                    "type": "object",
                    "properties": {
                        "reason": {"type": "string", "description": "Reason for escalation"},
                        "department": {"type": "string", "description": "Target department"},
                        "phone_number": {"type": "string"},
                    },
                    "required": ["reason"],
                    "additionalProperties": False,
                },
                handler_method="handle_escalate_to_agent",
            ),
        ]

    def _parse_custom_tools(self) -> list[AdapterToolDefinition]:
        """Parse custom tool definitions from config."""
        tools = []
        for tool_raw in self._custom_tools_raw:
            try:
                tools.append(AdapterToolDefinition(
                    name=tool_raw["name"],
                    description=tool_raw.get("description", ""),
                    parameters=tool_raw.get("parameters", {"type": "object", "properties": {}}),
                    handler_method="handle_webhook_tool",
                ))
            except (KeyError, TypeError) as exc:
                logger.warning(f"Skipping invalid custom tool definition: {exc}")
        return tools

    def execute_tool(self, tool_name: str, args: dict[str, Any]) -> AdapterResponse:
        # In webhook mode, forward all tool calls to webhook
        if self._mode == "webhook" and self._webhook_url:
            return self._forward_to_webhook(tool_name, args)

        # In custom mode with webhook, also forward
        if self._custom_tools_raw and self._webhook_url:
            return self._forward_to_webhook(tool_name, args)

        # Otherwise dispatch to built-in handlers
        return self._dispatch_tool(tool_name, args)

    def health_check(self) -> AdapterResponse:
        if self._webhook_url:
            try:
                req = Request(self._webhook_url, method="GET")
                with urlopen(req, timeout=5) as resp:
                    return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, message="Webhook reachable.")
            except Exception as exc:
                return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=str(exc))
        return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, message="Generic adapter (conversational mode).")

    def authenticate(self) -> bool:
        self._authenticated = True
        return True

    # ── Built-in Tool Handlers ─────────────────────────────────────

    def handle_lookup_info(self, query: str = "", category: str = "general", **kwargs) -> AdapterResponse:
        return AdapterResponse(
            ok=True,
            status=AdapterStatus.SUCCESS,
            data={
                "query": query,
                "category": category,
                "message": f"I've noted your inquiry about: {query}. "
                           "Let me connect you to the right department for detailed information.",
            },
            message="Information request noted.",
        )

    def handle_create_ticket(
        self,
        caller_name: str = "",
        phone_number: str = "",
        issue_description: str = "",
        priority: str = "medium",
        category: str = "general",
        **kwargs,
    ) -> AdapterResponse:
        import uuid
        ticket_id = f"TKT-{uuid.uuid4().hex[:8].upper()}"
        return AdapterResponse(
            ok=True,
            status=AdapterStatus.SUCCESS,
            data={
                "ticket_id": ticket_id,
                "caller_name": caller_name,
                "phone_number": phone_number,
                "issue_description": issue_description,
                "priority": priority,
                "category": category,
                "status": "created",
                "message": f"Your ticket {ticket_id} has been created. "
                           "Our team will contact you within 24 hours.",
            },
            message=f"Support ticket {ticket_id} created.",
        )

    def handle_check_status(
        self,
        ticket_id: str | None = None,
        phone_number: str | None = None,
        reference_number: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        ref = ticket_id or reference_number or "N/A"
        return AdapterResponse(
            ok=True,
            status=AdapterStatus.SUCCESS,
            data={
                "reference": ref,
                "status": "in_progress",
                "message": f"Your request {ref} is being processed. "
                           "You will receive an update via SMS.",
            },
            message="Status check completed.",
        )

    def handle_escalate_to_agent(
        self,
        reason: str = "",
        department: str = "general",
        phone_number: str = "",
        **kwargs,
    ) -> AdapterResponse:
        return AdapterResponse(
            ok=True,
            status=AdapterStatus.ESCALATE,
            data={
                "reason": reason,
                "department": department,
                "message": "Transferring you to a live agent. Please hold.",
            },
            message="Escalation initiated.",
        )

    def handle_webhook_tool(self, **kwargs) -> AdapterResponse:
        """Handler for custom tools that forward to webhook."""
        return self._forward_to_webhook("custom_tool", kwargs)

    # ── Webhook Forwarding ─────────────────────────────────────────

    def _forward_to_webhook(self, tool_name: str, args: dict) -> AdapterResponse:
        """Forward a tool call to the configured webhook URL."""
        payload = json.dumps({
            "domain_id": self.config.domain_id,
            "tool_name": tool_name,
            "arguments": args,
        }).encode()

        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.config.api_key:
            headers["X-API-Key"] = self.config.api_key

        try:
            req = Request(self._webhook_url, data=payload, headers=headers, method="POST")
            with urlopen(req, timeout=self.config.timeout_seconds) as resp:
                data = json.loads(resp.read().decode())
                return AdapterResponse(
                    ok=data.get("ok", True),
                    status=AdapterStatus.SUCCESS,
                    data=data,
                    message=data.get("message", ""),
                )
        except HTTPError as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=f"Webhook error: HTTP {exc.code}")
        except URLError as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.TIMEOUT, error=f"Webhook unreachable: {exc.reason}")
        except Exception as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=f"Webhook call failed: {exc}")
