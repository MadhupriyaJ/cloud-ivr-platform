"""
Banking Domain Adapter
======================
Connects IVR to Core Banking System (CBS).
Handles: account balance, card blocking, fund transfer,
loan status, mini statement, cheque status.

Production mode connects to real CBS REST API.
Demo mode returns realistic placeholder responses.
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


class BankingAdapter(BaseDomainAdapter):
    """
    Domain adapter for Core Banking Systems.

    Tools exposed:
    - verify_customer: Verify customer identity via phone/account
    - get_account_balance: Check account balance
    - block_card: Block a debit/credit card
    - get_mini_statement: Get recent transactions
    - get_loan_status: Check loan EMI and status
    - initiate_fund_transfer: Start a fund transfer (requires OTP)
    - get_cheque_status: Check cheque clearance status
    """

    def __init__(self, config: AdapterConfig):
        super().__init__(config)

    @property
    def _is_demo_mode(self) -> bool:
        return not self.config.api_base_url

    def get_tool_definitions(self) -> list[AdapterToolDefinition]:
        return [
            AdapterToolDefinition(
                name="verify_customer",
                description="Verify banking customer identity using phone number or account number.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string", "description": "Registered mobile number"},
                        "account_number": {"type": "string", "description": "Bank account number"},
                        "last_four_digits": {"type": "string", "description": "Last 4 digits of card"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_verify_customer",
            ),
            AdapterToolDefinition(
                name="get_account_balance",
                description="Get current account balance for a verified customer.",
                parameters={
                    "type": "object",
                    "properties": {
                        "account_number": {"type": "string"},
                        "phone_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_account_balance",
            ),
            AdapterToolDefinition(
                name="block_card",
                description="Block a debit or credit card immediately for security.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "card_type": {"type": "string", "description": "debit or credit"},
                        "last_four_digits": {"type": "string", "description": "Last 4 digits of card number"},
                        "reason": {"type": "string", "description": "Reason: lost, stolen, suspicious"},
                    },
                    "required": ["phone_number", "card_type", "last_four_digits"],
                    "additionalProperties": False,
                },
                handler_method="handle_block_card",
            ),
            AdapterToolDefinition(
                name="get_mini_statement",
                description="Get last 5 transactions for the customer's account.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "account_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_mini_statement",
            ),
            AdapterToolDefinition(
                name="get_loan_status",
                description="Check loan account status, EMI details, and next payment date.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "loan_account_number": {"type": "string"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_loan_status",
            ),
            AdapterToolDefinition(
                name="initiate_fund_transfer",
                description="Initiate a fund transfer. OTP verification will be required.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "from_account": {"type": "string"},
                        "to_account": {"type": "string"},
                        "amount": {"type": "string", "description": "Amount in INR"},
                        "beneficiary_name": {"type": "string"},
                    },
                    "required": ["phone_number", "to_account", "amount"],
                    "additionalProperties": False,
                },
                handler_method="handle_initiate_fund_transfer",
            ),
            AdapterToolDefinition(
                name="get_cheque_status",
                description="Check cheque clearance status by cheque number.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "cheque_number": {"type": "string"},
                    },
                    "required": ["cheque_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_cheque_status",
            ),
        ]

    def execute_tool(self, tool_name: str, args: dict[str, Any]) -> AdapterResponse:
        self.ensure_authenticated()
        return self._dispatch_tool(tool_name, args)

    def health_check(self) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, message="Banking demo mode healthy.")
        return self._api_get("/health")

    def authenticate(self) -> bool:
        if self.config.auth_type == "none":
            self._authenticated = True
            return True
        if self.config.auth_type == "api_key":
            self._authenticated = bool(self.config.api_key)
            return self._authenticated
        self._authenticated = True
        return True

    # ── Tool Handlers ──────────────────────────────────────────────

    def handle_verify_customer(
        self,
        phone_number: str = "",
        account_number: str | None = None,
        last_four_digits: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "verified": True,
                    "customer_name": "Rajesh Kumar",
                    "phone_number": phone_number,
                    "account_number": account_number or "XXXX-XXXX-4521",
                    "note": "Demo verification. Use OTP in production.",
                },
                message="Customer verified successfully.",
            )
        return self._api_post("/api/banking/customers/verify", {
            "phone_number": phone_number,
            "account_number": account_number,
            "last_four_digits": last_four_digits,
        })

    def handle_get_account_balance(
        self,
        phone_number: str = "",
        account_number: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "account_number": account_number or "XXXX-XXXX-4521",
                    "account_type": "savings",
                    "available_balance": "45,230.50",
                    "currency": "INR",
                    "as_of": "2026-03-26T10:00:00Z",
                },
                message="Account balance retrieved.",
            )
        return self._api_get("/api/banking/accounts/balance", {
            "phone_number": phone_number,
            "account_number": account_number,
        })

    def handle_block_card(
        self,
        phone_number: str = "",
        card_type: str = "debit",
        last_four_digits: str = "",
        reason: str = "lost",
        **kwargs,
    ) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "card_type": card_type,
                    "last_four_digits": last_four_digits,
                    "status": "blocked",
                    "reference_number": "BLK-20260326-A1B2C3",
                    "message": f"Your {card_type} card ending {last_four_digits} has been blocked. "
                               f"Please visit the nearest branch for a replacement.",
                },
                message=f"{card_type.title()} card blocked successfully.",
            )
        return self._api_post("/api/banking/cards/block", {
            "phone_number": phone_number,
            "card_type": card_type,
            "last_four_digits": last_four_digits,
            "reason": reason,
        })

    def handle_get_mini_statement(
        self,
        phone_number: str = "",
        account_number: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "account_number": account_number or "XXXX-XXXX-4521",
                    "transactions": [
                        {"date": "2026-03-25", "description": "UPI Payment", "amount": "-500.00", "balance": "45,230.50"},
                        {"date": "2026-03-24", "description": "Salary Credit", "amount": "+75,000.00", "balance": "45,730.50"},
                        {"date": "2026-03-23", "description": "ATM Withdrawal", "amount": "-2,000.00", "balance": "-29,269.50"},
                        {"date": "2026-03-22", "description": "Online Shopping", "amount": "-1,499.00", "balance": "-27,269.50"},
                        {"date": "2026-03-21", "description": "Electricity Bill", "amount": "-850.00", "balance": "-25,770.50"},
                    ],
                },
                message="Last 5 transactions retrieved.",
            )
        return self._api_get("/api/banking/accounts/mini-statement", {
            "phone_number": phone_number,
            "account_number": account_number,
        })

    def handle_get_loan_status(
        self,
        phone_number: str = "",
        loan_account_number: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "loan_account_number": loan_account_number or "LN-2024-78901",
                    "loan_type": "Home Loan",
                    "principal_amount": "25,00,000",
                    "outstanding_balance": "18,75,000",
                    "emi_amount": "22,500",
                    "next_emi_date": "2026-04-05",
                    "status": "active",
                    "currency": "INR",
                },
                message="Loan status retrieved.",
            )
        return self._api_get("/api/banking/loans/status", {
            "phone_number": phone_number,
            "loan_account_number": loan_account_number,
        })

    def handle_initiate_fund_transfer(
        self,
        phone_number: str = "",
        from_account: str | None = None,
        to_account: str = "",
        amount: str = "",
        beneficiary_name: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "transfer_status": "otp_required",
                    "reference_number": "TXN-20260326-X9Y8Z7",
                    "from_account": from_account or "XXXX-XXXX-4521",
                    "to_account": to_account,
                    "amount": amount,
                    "beneficiary_name": beneficiary_name or "Unknown",
                    "message": "An OTP has been sent to your registered mobile number. "
                               "Please provide the OTP to complete the transfer.",
                },
                message="Fund transfer initiated. OTP verification required.",
            )
        return self._api_post("/api/banking/transfers/initiate", {
            "phone_number": phone_number,
            "from_account": from_account,
            "to_account": to_account,
            "amount": amount,
            "beneficiary_name": beneficiary_name,
        })

    def handle_get_cheque_status(
        self,
        phone_number: str | None = None,
        cheque_number: str = "",
        **kwargs,
    ) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "cheque_number": cheque_number,
                    "status": "cleared",
                    "clearance_date": "2026-03-24",
                    "amount": "15,000.00",
                    "currency": "INR",
                },
                message="Cheque status retrieved.",
            )
        return self._api_get("/api/banking/cheques/status", {
            "phone_number": phone_number,
            "cheque_number": cheque_number,
        })

    # ── HTTP Helpers ───────────────────────────────────────────────

    def _api_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.config.auth_type == "api_key" and self.config.api_key:
            headers["X-API-Key"] = self.config.api_key
        elif self._auth_token:
            headers["Authorization"] = f"Bearer {self._auth_token}"
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
        except HTTPError as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=f"CBS API error: HTTP {exc.code}")
        except URLError as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.TIMEOUT, error=f"CBS API unreachable: {exc.reason}")
        except Exception as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=f"CBS API call failed: {exc}")

    def _api_post(self, path: str, body: dict) -> AdapterResponse:
        url = f"{self.config.api_base_url.rstrip('/')}{path}"
        try:
            data = json.dumps({k: v for k, v in body.items() if v is not None}).encode()
            req = Request(url, data=data, headers=self._api_headers(), method="POST")
            with urlopen(req, timeout=self.config.timeout_seconds) as resp:
                result = json.loads(resp.read().decode())
                return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, data=result)
        except HTTPError as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=f"CBS API error: HTTP {exc.code}")
        except URLError as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.TIMEOUT, error=f"CBS API unreachable: {exc.reason}")
        except Exception as exc:
            return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=f"CBS API call failed: {exc}")
