"""
IVR Session Analytics
=====================
Tracks and analyzes IVR session metrics for monitoring
and continuous improvement.

Metrics tracked:
- Session duration
- Intent classification accuracy
- Tool execution success/failure rates
- Escalation rates
- Domain-level aggregations
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class SessionMetrics:
    """Metrics for a single IVR session."""
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    domain_id: str = ""
    caller_phone: str = ""
    started_at: float = field(default_factory=time.time)
    ended_at: float = 0
    duration_seconds: float = 0
    intents_detected: list[str] = field(default_factory=list)
    tools_called: list[str] = field(default_factory=list)
    tool_success_count: int = 0
    tool_failure_count: int = 0
    escalated: bool = False
    escalation_reason: str = ""
    resolution: str = "unknown"  # resolved, escalated, abandoned, error

    def end_session(self, resolution: str = "resolved"):
        self.ended_at = time.time()
        self.duration_seconds = self.ended_at - self.started_at
        self.resolution = resolution

    def record_tool_call(self, tool_name: str, success: bool):
        self.tools_called.append(tool_name)
        if success:
            self.tool_success_count += 1
        else:
            self.tool_failure_count += 1

    def record_intent(self, intent: str):
        self.intents_detected.append(intent)

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "domain_id": self.domain_id,
            "started_at": self.started_at,
            "duration_seconds": round(self.duration_seconds, 1),
            "intents_detected": self.intents_detected,
            "tools_called": self.tools_called,
            "tool_success_count": self.tool_success_count,
            "tool_failure_count": self.tool_failure_count,
            "escalated": self.escalated,
            "resolution": self.resolution,
        }


class AnalyticsCollector:
    """
    Collects and aggregates IVR session analytics.

    Usage:
        collector = AnalyticsCollector()
        session = collector.start_session("hospital")
        session.record_tool_call("book_appointment", True)
        session.end_session("resolved")
    """

    def __init__(self, max_sessions: int = 5000):
        self._sessions: list[SessionMetrics] = []
        self._max_sessions = max_sessions

    def start_session(self, domain_id: str, caller_phone: str = "") -> SessionMetrics:
        session = SessionMetrics(domain_id=domain_id, caller_phone=caller_phone)
        self._sessions.append(session)
        if len(self._sessions) > self._max_sessions:
            self._sessions = self._sessions[-self._max_sessions:]
        return session

    def get_domain_summary(self, domain_id: str) -> dict[str, Any]:
        """Get aggregated metrics for a domain."""
        domain_sessions = [s for s in self._sessions if s.domain_id == domain_id and s.ended_at > 0]
        if not domain_sessions:
            return {"domain_id": domain_id, "total_sessions": 0}

        total = len(domain_sessions)
        avg_duration = sum(s.duration_seconds for s in domain_sessions) / total
        escalated = sum(1 for s in domain_sessions if s.escalated)
        resolved = sum(1 for s in domain_sessions if s.resolution == "resolved")
        tool_calls = sum(s.tool_success_count + s.tool_failure_count for s in domain_sessions)
        tool_success = sum(s.tool_success_count for s in domain_sessions)

        return {
            "domain_id": domain_id,
            "total_sessions": total,
            "avg_duration_seconds": round(avg_duration, 1),
            "escalation_rate": round(escalated / total * 100, 1) if total else 0,
            "resolution_rate": round(resolved / total * 100, 1) if total else 0,
            "total_tool_calls": tool_calls,
            "tool_success_rate": round(tool_success / tool_calls * 100, 1) if tool_calls else 0,
        }

    def get_recent_sessions(self, domain_id: str | None = None, limit: int = 50) -> list[dict]:
        sessions = self._sessions
        if domain_id:
            sessions = [s for s in sessions if s.domain_id == domain_id]
        return [s.to_dict() for s in sessions[-limit:]]
