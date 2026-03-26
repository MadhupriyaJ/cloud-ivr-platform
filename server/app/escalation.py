"""
Escalation Manager
==================
Handles escalation from IVR to human agents.
Supports multiple escalation channels:
1. SIP transfer (traditional PBX)
2. Queue-based (contact center)
3. Callback scheduling
4. Webhook notification (external systems)

The escalation manager is domain-aware and uses the domain's
escalation configuration to determine the appropriate channel.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


@dataclass
class EscalationRequest:
    """Represents an escalation request."""
    id: str = field(default_factory=lambda: f"ESC-{uuid.uuid4().hex[:8].upper()}")
    domain_id: str = ""
    caller_phone: str = ""
    reason: str = ""
    department: str = "general"
    priority: str = "normal"  # low, normal, high, urgent
    context_summary: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = "pending"  # pending, queued, transferred, completed, failed
    channel: str = "queue"  # sip, queue, callback, webhook

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "domain_id": self.domain_id,
            "caller_phone": self.caller_phone,
            "reason": self.reason,
            "department": self.department,
            "priority": self.priority,
            "context_summary": self.context_summary,
            "created_at": self.created_at,
            "status": self.status,
            "channel": self.channel,
        }


@dataclass
class EscalationConfig:
    """Domain-specific escalation configuration."""
    default_channel: str = "queue"
    sip_transfer_number: str = ""
    queue_name: str = "default"
    callback_enabled: bool = True
    webhook_url: str = ""
    max_wait_seconds: int = 300
    departments: dict[str, str] = field(default_factory=dict)  # dept -> queue/number

    @classmethod
    def from_dict(cls, data: dict) -> EscalationConfig:
        return cls(
            default_channel=data.get("default_channel", "queue"),
            sip_transfer_number=data.get("sip_transfer_number", ""),
            queue_name=data.get("queue_name", "default"),
            callback_enabled=data.get("callback_enabled", True),
            webhook_url=data.get("webhook_url", ""),
            max_wait_seconds=data.get("max_wait_seconds", 300),
            departments=data.get("departments", {}),
        )


class EscalationManager:
    """
    Manages escalation from IVR to human agents.

    Usage:
        manager = EscalationManager()
        result = manager.escalate(request, config)
    """

    def __init__(self):
        self._pending_escalations: list[EscalationRequest] = []
        self._max_history = 500

    def escalate(
        self,
        request: EscalationRequest,
        config: EscalationConfig | None = None,
    ) -> dict[str, Any]:
        """
        Process an escalation request.
        Returns a dict with escalation status and instructions.
        """
        config = config or EscalationConfig()
        channel = request.channel or config.default_channel

        # Determine department-specific routing
        dept_target = config.departments.get(request.department, "")

        result: dict[str, Any] = {
            "escalation_id": request.id,
            "channel": channel,
            "status": "pending",
            "message": "",
        }

        if channel == "sip":
            result = self._handle_sip_transfer(request, config, dept_target)
        elif channel == "queue":
            result = self._handle_queue(request, config, dept_target)
        elif channel == "callback":
            result = self._handle_callback(request, config)
        elif channel == "webhook":
            result = self._handle_webhook(request, config)
        else:
            result["status"] = "queued"
            result["message"] = "Your request has been queued. An agent will be with you shortly."

        # Record escalation
        request.status = result.get("status", "pending")
        self._pending_escalations.append(request)
        if len(self._pending_escalations) > self._max_history:
            self._pending_escalations = self._pending_escalations[-self._max_history:]

        return result

    def _handle_sip_transfer(
        self,
        request: EscalationRequest,
        config: EscalationConfig,
        dept_target: str,
    ) -> dict[str, Any]:
        """Handle SIP-based call transfer."""
        transfer_number = dept_target or config.sip_transfer_number
        if not transfer_number:
            return {
                "escalation_id": request.id,
                "channel": "sip",
                "status": "failed",
                "message": "No transfer number configured. Please try again later.",
            }
        return {
            "escalation_id": request.id,
            "channel": "sip",
            "status": "transferring",
            "transfer_to": transfer_number,
            "message": f"Transferring your call to {request.department} department. Please hold.",
            "sip_action": {
                "type": "transfer",
                "target": transfer_number,
                "context": request.context_summary,
            },
        }

    def _handle_queue(
        self,
        request: EscalationRequest,
        config: EscalationConfig,
        dept_target: str,
    ) -> dict[str, Any]:
        """Handle queue-based escalation."""
        queue = dept_target or config.queue_name
        return {
            "escalation_id": request.id,
            "channel": "queue",
            "status": "queued",
            "queue_name": queue,
            "estimated_wait": f"{config.max_wait_seconds // 60} minutes",
            "message": (
                f"You have been added to the {request.department} queue. "
                f"Estimated wait time is {config.max_wait_seconds // 60} minutes. "
                "An agent will be with you shortly."
            ),
        }

    def _handle_callback(
        self,
        request: EscalationRequest,
        config: EscalationConfig,
    ) -> dict[str, Any]:
        """Handle callback scheduling."""
        if not config.callback_enabled:
            return {
                "escalation_id": request.id,
                "channel": "callback",
                "status": "failed",
                "message": "Callback is not available at this time.",
            }
        return {
            "escalation_id": request.id,
            "channel": "callback",
            "status": "scheduled",
            "callback_phone": request.caller_phone,
            "message": (
                f"We have scheduled a callback to {request.caller_phone}. "
                "Our agent will call you within the next 30 minutes."
            ),
        }

    def _handle_webhook(
        self,
        request: EscalationRequest,
        config: EscalationConfig,
    ) -> dict[str, Any]:
        """Notify external system via webhook."""
        if not config.webhook_url:
            return {
                "escalation_id": request.id,
                "channel": "webhook",
                "status": "failed",
                "message": "Webhook not configured.",
            }
        try:
            payload = json.dumps(request.to_dict()).encode()
            req = Request(
                config.webhook_url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=10) as resp:
                return {
                    "escalation_id": request.id,
                    "channel": "webhook",
                    "status": "notified",
                    "message": "Your request has been forwarded. An agent will contact you shortly.",
                }
        except Exception as exc:
            logger.error(f"Escalation webhook failed: {exc}")
            return {
                "escalation_id": request.id,
                "channel": "webhook",
                "status": "failed",
                "message": "Unable to notify the team. Please try calling again.",
            }

    def get_pending_escalations(self, domain_id: str | None = None) -> list[dict]:
        """Get pending escalations for monitoring."""
        escalations = self._pending_escalations
        if domain_id:
            escalations = [e for e in escalations if e.domain_id == domain_id]
        return [e.to_dict() for e in escalations if e.status in ("pending", "queued")]
