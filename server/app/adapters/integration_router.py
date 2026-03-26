"""
Integration Router
==================
Routes IVR tool calls to the correct domain adapter.
Implements retry logic, circuit breaker, and fallback handling.

Flow:
    Caller → IVR → AI → Intent → Integration Router → Domain Adapter → Core System → Response

The router:
1. Resolves the correct adapter for the current domain
2. Ensures the adapter is authenticated
3. Executes the tool call with retry logic
4. Handles failures with circuit breaker pattern
5. Returns normalized AdapterResponse
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from .adapter_registry import AdapterRegistry
from .base_adapter import AdapterConfig, AdapterResponse, AdapterStatus, BaseDomainAdapter

logger = logging.getLogger(__name__)


@dataclass
class CircuitBreakerState:
    """Tracks circuit breaker state per adapter instance."""

    failure_count: int = 0
    last_failure_time: float = 0
    state: str = "closed"  # closed, open, half_open
    failure_threshold: int = 5
    recovery_timeout: float = 60.0  # seconds

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"Circuit breaker OPENED after {self.failure_count} failures.")

    def record_success(self) -> None:
        self.failure_count = 0
        self.state = "closed"

    def can_execute(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            elapsed = time.time() - self.last_failure_time
            if elapsed >= self.recovery_timeout:
                self.state = "half_open"
                return True
            return False
        # half_open: allow one attempt
        return True


@dataclass
class ToolExecutionLog:
    """Audit log entry for a tool execution."""

    domain_id: str
    tool_name: str
    args: dict[str, Any]
    response: AdapterResponse | None = None
    attempt_count: int = 0
    started_at: float = field(default_factory=time.time)
    completed_at: float = 0
    error: str = ""


class IntegrationRouter:
    """
    Central routing layer between IVR AI and domain core systems.

    Usage:
        router = IntegrationRouter(adapter_registry)
        result = router.execute_tool(domain_id, adapter_config, tool_name, args)
    """

    def __init__(self, registry: AdapterRegistry):
        self.registry = registry
        self._circuit_breakers: dict[str, CircuitBreakerState] = {}
        self._execution_logs: list[ToolExecutionLog] = []
        self._max_log_entries = 1000

    def execute_tool(
        self,
        domain_id: str,
        adapter_config: AdapterConfig,
        tool_name: str,
        args: dict[str, Any],
    ) -> dict:
        """
        Execute a tool call through the appropriate domain adapter.
        Returns a dict suitable for OpenAI function_call_output.
        """
        log_entry = ToolExecutionLog(
            domain_id=domain_id,
            tool_name=tool_name,
            args=args,
        )

        # Check circuit breaker
        cb = self._get_circuit_breaker(domain_id)
        if not cb.can_execute():
            log_entry.error = "Circuit breaker open"
            log_entry.completed_at = time.time()
            self._record_log(log_entry)
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.ERROR,
                error="Service temporarily unavailable. Please try again later.",
                message="The backend system is temporarily unreachable.",
            ).to_dict()

        # Get adapter
        try:
            adapter = self.registry.get_adapter(domain_id, adapter_config)
        except Exception as exc:
            logger.error(f"Failed to get adapter for domain '{domain_id}': {exc}")
            log_entry.error = str(exc)
            log_entry.completed_at = time.time()
            self._record_log(log_entry)
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.ERROR,
                error=f"Adapter initialization failed: {exc}",
            ).to_dict()

        # Ensure authenticated
        try:
            adapter.ensure_authenticated()
        except Exception as exc:
            logger.error(f"Authentication failed for domain '{domain_id}': {exc}")
            cb.record_failure()
            log_entry.error = f"Auth failed: {exc}"
            log_entry.completed_at = time.time()
            self._record_log(log_entry)
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.UNAUTHORIZED,
                error="Authentication with the backend system failed.",
            ).to_dict()

        # Execute with retry
        max_retries = adapter_config.max_retries
        last_error = ""

        for attempt in range(1, max_retries + 1):
            log_entry.attempt_count = attempt
            try:
                result = adapter.execute_tool(tool_name, args)
                if result.ok:
                    cb.record_success()
                    log_entry.response = result
                    log_entry.completed_at = time.time()
                    self._record_log(log_entry)
                    return result.to_dict()
                else:
                    last_error = result.error
                    # Don't retry on business logic errors (not_found, etc.)
                    if result.status in (AdapterStatus.NOT_FOUND, AdapterStatus.ESCALATE):
                        log_entry.response = result
                        log_entry.completed_at = time.time()
                        self._record_log(log_entry)
                        return result.to_dict()
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    f"Tool execution attempt {attempt}/{max_retries} failed "
                    f"for '{tool_name}' on domain '{domain_id}': {exc}"
                )

            # Brief delay before retry
            if attempt < max_retries:
                time.sleep(0.5 * attempt)

        # All retries exhausted
        cb.record_failure()
        log_entry.error = f"All {max_retries} attempts failed: {last_error}"
        log_entry.completed_at = time.time()
        self._record_log(log_entry)

        return AdapterResponse(
            ok=False,
            status=AdapterStatus.ERROR,
            error=f"Operation failed after {max_retries} attempts. {last_error}",
            message="I'm having trouble connecting to the system. Let me transfer you to an agent.",
        ).to_dict()

    def create_tool_handler(
        self,
        domain_id: str,
        adapter_config: AdapterConfig,
    ):
        """
        Create a tool_handler function compatible with bridge.py.
        This is the key integration point that replaces hospital_store.execute_tool.
        """

        def tool_handler(tool_name: str, args: dict) -> dict:
            return self.execute_tool(domain_id, adapter_config, tool_name, args)

        return tool_handler

    def get_adapter_tools(
        self,
        domain_id: str,
        adapter_config: AdapterConfig,
    ) -> list[dict]:
        """
        Get OpenAI-formatted tool definitions for a domain.
        Used during session initialization instead of hardcoded HOSPITAL_TOOLS.
        """
        try:
            adapter = self.registry.get_adapter(domain_id, adapter_config)
            return adapter.get_openai_tools()
        except Exception as exc:
            logger.error(f"Failed to get tools for domain '{domain_id}': {exc}")
            return []

    def health_check(self, domain_id: str, adapter_config: AdapterConfig) -> dict:
        """Check health of a domain's core system connection."""
        try:
            adapter = self.registry.get_adapter(domain_id, adapter_config)
            result = adapter.health_check()
            return result.to_dict()
        except Exception as exc:
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.ERROR,
                error=str(exc),
            ).to_dict()

    def _get_circuit_breaker(self, domain_id: str) -> CircuitBreakerState:
        if domain_id not in self._circuit_breakers:
            self._circuit_breakers[domain_id] = CircuitBreakerState()
        return self._circuit_breakers[domain_id]

    def _record_log(self, entry: ToolExecutionLog) -> None:
        self._execution_logs.append(entry)
        if len(self._execution_logs) > self._max_log_entries:
            self._execution_logs = self._execution_logs[-self._max_log_entries:]

    def get_recent_logs(self, domain_id: str | None = None, limit: int = 50) -> list[dict]:
        """Get recent tool execution logs for monitoring."""
        logs = self._execution_logs
        if domain_id:
            logs = [l for l in logs if l.domain_id == domain_id]
        return [
            {
                "domain_id": l.domain_id,
                "tool_name": l.tool_name,
                "attempt_count": l.attempt_count,
                "started_at": l.started_at,
                "completed_at": l.completed_at,
                "ok": l.response.ok if l.response else False,
                "error": l.error,
            }
            for l in logs[-limit:]
        ]
