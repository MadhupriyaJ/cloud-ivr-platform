"""
Insurance Domain Adapter
========================
Connects IVR to Insurance Management System.
Handles: policy lookup, claim status, premium payment,
renewal status, document requests.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .base_adapter import (
    AdapterConfig,
    AdapterResponse,
    AdapterStatus,
    AdapterToolDefinition,
    BaseDomainAdapter,
)

logger = logging.getLogger(__name__)


class InsuranceAdapter(BaseDomainAdapter):
    """
    Domain adapter for Insurance Management Systems.

    Tools exposed:
    - verify_policyholder: Verify policyholder identity
    - get_policy_details: Get policy information
    - get_claim_status: Check claim status
    - get_premium_info: Get premium payment details
    - get_renewal_status: Check policy renewal status
    """

    def __init__(self, config: AdapterConfig):
        super().__init__(config)

    @property
    def _is_demo_mode(self) -> bool:
        return not self.config.api_base_url

    def get_tool_definitions(self) -> list[AdapterToolDefinition]:
        return [
            AdapterToolDefinition(
                name="verify_policyholder",
                description="Verify policyholder identity using phone number or policy number.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "policy_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_verify_policyholder",
            ),
            AdapterToolDefinition(
                name="get_policy_details",
                description="Get policy details including coverage, sum insured, and validity.",
                parameters={
                    "type": "object",
                    "properties": {
                        "policy_number": {"type": "string"},
                        "phone_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_policy_details",
            ),
            AdapterToolDefinition(
                name="get_claim_status",
                description="Check the status of an insurance claim.",
                parameters={
                    "type": "object",
                    "properties": {
                        "claim_number": {"type": "string"},
                        "phone_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_claim_status",
            ),
            AdapterToolDefinition(
                name="get_premium_info",
                description="Get premium payment details and next due date.",
                parameters={
                    "type": "object",
                    "properties": {
                        "policy_number": {"type": "string"},
                        "phone_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_premium_info",
            ),
            AdapterToolDefinition(
                name="get_renewal_status",
                description="Check policy renewal status and upcoming renewal date.",
                parameters={
                    "type": "object",
                    "properties": {
                        "policy_number": {"type": "string"},
                        "phone_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_renewal_status",
            ),
        ]

    def execute_tool(self, tool_name: str, args: dict[str, Any]) -> AdapterResponse:
        self.ensure_authenticated()
        return self._dispatch_tool(tool_name, args)

    def health_check(self) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, message="Insurance demo mode healthy.")
        return self._api_get("/health")

    def authenticate(self) -> bool:
        self._authenticated = True
        return True

    # ── Tool Handlers ──────────────────────────────────────────────

    def handle_verify_policyholder(self, phone_number: str = "", policy_number: str | None = None, **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"verified": True, "customer_name": "Priya Sharma", "phone_number": phone_number,
                       "policy_number": policy_number or "POL-2024-56789"},
                message="Policyholder verified.",
            )
        return self._api_post("/api/insurance/policyholders/verify", {"phone_number": phone_number, "policy_number": policy_number})

    def handle_get_policy_details(self, policy_number: str | None = None, phone_number: str = "", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"policy_number": policy_number or "POL-2024-56789", "policy_type": "Health Insurance",
                       "sum_insured": "5,00,000", "currency": "INR", "valid_from": "2025-04-01",
                       "valid_to": "2026-03-31", "status": "active", "members_covered": 4},
                message="Policy details retrieved.",
            )
        return self._api_get("/api/insurance/policies", {"policy_number": policy_number, "phone_number": phone_number})

    def handle_get_claim_status(self, claim_number: str | None = None, phone_number: str = "", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"claim_number": claim_number or "CLM-2026-12345", "status": "under_review",
                       "submitted_date": "2026-03-15", "claim_amount": "35,000", "currency": "INR",
                       "expected_settlement": "2026-04-05",
                       "message": "Your claim is under review. Expected settlement by April 5."},
                message="Claim status retrieved.",
            )
        return self._api_get("/api/insurance/claims/status", {"claim_number": claim_number, "phone_number": phone_number})

    def handle_get_premium_info(self, policy_number: str | None = None, phone_number: str = "", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"policy_number": policy_number or "POL-2024-56789", "premium_amount": "12,500",
                       "frequency": "quarterly", "next_due_date": "2026-04-01", "currency": "INR",
                       "payment_status": "upcoming"},
                message="Premium information retrieved.",
            )
        return self._api_get("/api/insurance/premiums", {"policy_number": policy_number, "phone_number": phone_number})

    def handle_get_renewal_status(self, policy_number: str | None = None, phone_number: str = "", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"policy_number": policy_number or "POL-2024-56789", "renewal_date": "2026-03-31",
                       "renewal_premium": "48,000", "currency": "INR", "status": "pending_renewal",
                       "message": "Your policy is due for renewal on March 31. Please renew to avoid lapse."},
                message="Renewal status retrieved.",
            )
        return self._api_get("/api/insurance/renewals", {"policy_number": policy_number, "phone_number": phone_number})

    # ── HTTP Helpers ───────────────────────────────────────────────

    def _api_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.config.api_key:
            headers["X-API-Key"] = self.config.api_key
        return headers

    def _api_get(self, path: str, params: dict | None = None) -> AdapterResponse:
        url = f"{self.config.api_base_url.rstrip('/')}{path}"
        if params:
            url += "?" + urlencode({k: v for k, v in params.items() if v is not None})
        try:
            req = Request(url, headers=self._api_headers(), method="GET")
            with urlopen(req, timeout=self.config.timeout_seconds) as resp:
                data = json.loads(resp.read().decode())
                return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, data=data)
        except (HTTPError, URLError, Exception) as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=str(exc))

    def _api_post(self, path: str, body: dict) -> AdapterResponse:
        url = f"{self.config.api_base_url.rstrip('/')}{path}"
        try:
            data = json.dumps({k: v for k, v in body.items() if v is not None}).encode()
            req = Request(url, data=data, headers=self._api_headers(), method="POST")
            with urlopen(req, timeout=self.config.timeout_seconds) as resp:
                result = json.loads(resp.read().decode())
                return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, data=result)
        except (HTTPError, URLError, Exception) as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=str(exc))
