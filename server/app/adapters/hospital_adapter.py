"""
Hospital Domain Adapter
=======================
Connects IVR to Hospital Management System (HMS).
Handles: patient verification, doctor lookup, appointment booking,
slot availability, appointment status, lab reports, billing.

This adapter can work in two modes:
1. LOCAL mode: Uses built-in SQLite store (demo/dev)
2. API mode: Connects to external HMS REST API (production)

The mode is determined by adapter_config.api_base_url:
- Empty/unset → LOCAL mode (uses HospitalStore)
- Set to URL → API mode (calls external HMS)
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


class HospitalAdapter(BaseDomainAdapter):
    """
    Domain adapter for Hospital Management Systems.

    Tools exposed:
    - verify_patient: Verify patient identity
    - get_available_slots: Check doctor availability
    - book_appointment: Book an appointment slot
    - get_appointment_status: Check appointment status
    - get_lab_report_status: Check lab report status
    - get_billing_info: Get billing/payment information
    """

    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        self._local_store = None

    @property
    def _is_local_mode(self) -> bool:
        return not self.config.api_base_url

    def _get_local_store(self):
        """Lazy-load the local HospitalStore for demo mode."""
        if self._local_store is None:
            from pathlib import Path
            from ..hospital import HospitalStore
            db_path = Path(__file__).resolve().parents[1] / "data" / "hospital.db"
            self._local_store = HospitalStore(db_path)
        return self._local_store

    def get_tool_definitions(self) -> list[AdapterToolDefinition]:
        return [
            AdapterToolDefinition(
                name="verify_patient",
                description="Verify patient identity using phone number, optionally DOB or MRN.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string", "description": "Patient phone number"},
                        "dob": {"type": "string", "description": "Date of birth YYYY-MM-DD"},
                        "mrn": {"type": "string", "description": "Medical Record Number"},
                    },
                    "required": ["phone_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_verify_patient",
            ),
            AdapterToolDefinition(
                name="get_available_slots",
                description="Get doctor-wise available appointment slots for a given date.",
                parameters={
                    "type": "object",
                    "properties": {
                        "visit_date": {"type": "string", "description": "YYYY-MM-DD"},
                        "specialty": {"type": "string", "description": "Medical specialty"},
                        "doctor_id": {"type": "string", "description": "Specific doctor ID"},
                    },
                    "required": ["visit_date"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_available_slots",
            ),
            AdapterToolDefinition(
                name="book_appointment",
                description="Book a confirmed appointment slot for a patient.",
                parameters={
                    "type": "object",
                    "properties": {
                        "patient_name": {"type": "string"},
                        "phone_number": {"type": "string"},
                        "visit_date": {"type": "string", "description": "YYYY-MM-DD"},
                        "slot_time": {"type": "string", "description": "HH:MM in 24h format"},
                        "specialty": {"type": "string"},
                        "doctor_id": {"type": "string"},
                        "idempotency_key": {"type": "string"},
                    },
                    "required": ["patient_name", "phone_number", "visit_date", "slot_time"],
                    "additionalProperties": False,
                },
                handler_method="handle_book_appointment",
            ),
            AdapterToolDefinition(
                name="get_appointment_status",
                description="Check appointment confirmation and status.",
                parameters={
                    "type": "object",
                    "properties": {
                        "appointment_id": {"type": "string"},
                        "confirmation_code": {"type": "string"},
                        "phone_number": {"type": "string"},
                        "visit_date": {"type": "string", "description": "YYYY-MM-DD"},
                    },
                    "additionalProperties": False,
                },
                handler_method="handle_get_appointment_status",
            ),
            AdapterToolDefinition(
                name="get_lab_report_status",
                description="Check status of a lab report by report ID or patient phone.",
                parameters={
                    "type": "object",
                    "properties": {
                        "report_id": {"type": "string"},
                        "phone_number": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
                handler_method="handle_get_lab_report_status",
            ),
            AdapterToolDefinition(
                name="get_billing_info",
                description="Get billing or payment information for a patient.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "appointment_id": {"type": "string"},
                        "invoice_id": {"type": "string"},
                    },
                    "additionalProperties": False,
                },
                handler_method="handle_get_billing_info",
            ),
        ]

    def execute_tool(self, tool_name: str, args: dict[str, Any]) -> AdapterResponse:
        """Route tool call to the appropriate handler."""
        self.ensure_authenticated()
        return self._dispatch_tool(tool_name, args)

    def health_check(self) -> AdapterResponse:
        if self._is_local_mode:
            try:
                store = self._get_local_store()
                store.list_doctors()
                return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, message="Local HMS store healthy.")
            except Exception as exc:
                return AdapterResponse(ok=False, status=AdapterStatus.ERROR, error=str(exc))
        else:
            return self._api_get("/health")

    def authenticate(self) -> bool:
        if self.config.auth_type == "none":
            self._authenticated = True
            return True
        if self.config.auth_type == "api_key":
            self._authenticated = bool(self.config.api_key)
            return self._authenticated
        if self.config.auth_type == "oauth2":
            return self._oauth2_authenticate()
        self._authenticated = True
        return True

    def _oauth2_authenticate(self) -> bool:
        """Handle OAuth2 authentication with HMS."""
        token_url = self.config.auth_config.get("token_url", "")
        client_id = self.config.auth_config.get("client_id", "")
        client_secret = self.config.auth_config.get("client_secret", "")
        if not all([token_url, client_id, client_secret]):
            logger.error("OAuth2 config incomplete for hospital adapter.")
            return False
        try:
            body = urlencode({
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            }).encode()
            req = Request(token_url, data=body, method="POST")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                self._auth_token = data.get("access_token")
                expires_in = data.get("expires_in", 3600)
                import time
                self._auth_expiry = time.time() + expires_in - 60
                self._authenticated = True
                return True
        except Exception as exc:
            logger.error(f"OAuth2 authentication failed: {exc}")
            return False

    # ── Tool Handlers ──────────────────────────────────────────────

    def handle_verify_patient(
        self,
        phone_number: str = "",
        dob: str | None = None,
        mrn: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_local_mode:
            result = self._get_local_store().verify_patient(phone_number, dob, mrn)
            return self._wrap_local_result(result)
        return self._api_post("/api/hospital/patients/verify", {
            "phone_number": phone_number,
            "dob": dob,
            "mrn": mrn,
        })

    def handle_get_available_slots(
        self,
        visit_date: str = "",
        specialty: str | None = None,
        doctor_id: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_local_mode:
            result = self._get_local_store().get_available_slots(visit_date, specialty, doctor_id)
            return self._wrap_local_result(result)
        params = {"visit_date": visit_date}
        if specialty:
            params["specialty"] = specialty
        if doctor_id:
            params["doctor_id"] = doctor_id
        return self._api_get("/api/hospital/slots", params)

    def handle_book_appointment(
        self,
        patient_name: str = "",
        phone_number: str = "",
        visit_date: str = "",
        slot_time: str = "",
        specialty: str | None = None,
        doctor_id: str | None = None,
        idempotency_key: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_local_mode:
            result = self._get_local_store().book_appointment(
                patient_name, phone_number, visit_date, slot_time,
                specialty, doctor_id, idempotency_key,
            )
            return self._wrap_local_result(result)
        return self._api_post("/api/hospital/appointments/book", {
            "patient_name": patient_name,
            "phone_number": phone_number,
            "visit_date": visit_date,
            "slot_time": slot_time,
            "specialty": specialty,
            "doctor_id": doctor_id,
            "idempotency_key": idempotency_key,
        })

    def handle_get_appointment_status(
        self,
        appointment_id: str | None = None,
        confirmation_code: str | None = None,
        phone_number: str | None = None,
        visit_date: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_local_mode:
            result = self._get_local_store().get_appointment_status(
                appointment_id, confirmation_code, phone_number, visit_date,
            )
            return self._wrap_local_result(result)
        params = {}
        if appointment_id:
            params["appointment_id"] = appointment_id
        if confirmation_code:
            params["confirmation_code"] = confirmation_code
        if phone_number:
            params["phone_number"] = phone_number
        if visit_date:
            params["visit_date"] = visit_date
        return self._api_get("/api/hospital/appointments/status", params)

    def handle_get_lab_report_status(
        self,
        report_id: str | None = None,
        phone_number: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_local_mode:
            # Demo: return placeholder
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "report_id": report_id or "N/A",
                    "status": "pending",
                    "message": "Lab report is being processed. Results expected within 24 hours.",
                },
                message="Lab report status retrieved.",
            )
        params = {}
        if report_id:
            params["report_id"] = report_id
        if phone_number:
            params["phone_number"] = phone_number
        return self._api_get("/api/hospital/lab-reports/status", params)

    def handle_get_billing_info(
        self,
        phone_number: str | None = None,
        appointment_id: str | None = None,
        invoice_id: str | None = None,
        **kwargs,
    ) -> AdapterResponse:
        if self._is_local_mode:
            # Demo: return placeholder
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data={
                    "phone_number": phone_number or "N/A",
                    "outstanding_balance": "0.00",
                    "currency": "INR",
                    "message": "No outstanding bills found.",
                },
                message="Billing information retrieved.",
            )
        params = {}
        if phone_number:
            params["phone_number"] = phone_number
        if appointment_id:
            params["appointment_id"] = appointment_id
        if invoice_id:
            params["invoice_id"] = invoice_id
        return self._api_get("/api/hospital/billing", params)

    # ── HTTP Helpers for API Mode ──────────────────────────────────

    def _api_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.config.auth_type == "api_key" and self.config.api_key:
            headers["X-API-Key"] = self.config.api_key
        elif self.config.auth_type == "oauth2" and self._auth_token:
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
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.ERROR,
                error=f"HMS API error: HTTP {exc.code}",
            )
        except URLError as exc:
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.TIMEOUT,
                error=f"HMS API unreachable: {exc.reason}",
            )
        except Exception as exc:
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.ERROR,
                error=f"HMS API call failed: {exc}",
            )

    def _api_post(self, path: str, body: dict) -> AdapterResponse:
        url = f"{self.config.api_base_url.rstrip('/')}{path}"
        try:
            data = json.dumps({k: v for k, v in body.items() if v is not None}).encode()
            req = Request(url, data=data, headers=self._api_headers(), method="POST")
            with urlopen(req, timeout=self.config.timeout_seconds) as resp:
                result = json.loads(resp.read().decode())
                return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, data=result)
        except HTTPError as exc:
            body_text = ""
            try:
                body_text = exc.read().decode()
            except Exception:
                pass
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.ERROR,
                error=f"HMS API error: HTTP {exc.code}. {body_text}",
            )
        except URLError as exc:
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.TIMEOUT,
                error=f"HMS API unreachable: {exc.reason}",
            )
        except Exception as exc:
            return AdapterResponse(
                ok=False,
                status=AdapterStatus.ERROR,
                error=f"HMS API call failed: {exc}",
            )

    def _wrap_local_result(self, result: dict) -> AdapterResponse:
        """Convert legacy HospitalStore dict result to AdapterResponse."""
        if result.get("ok"):
            return AdapterResponse(
                ok=True,
                status=AdapterStatus.SUCCESS,
                data=result,
                message=result.get("message", ""),
            )
        return AdapterResponse(
            ok=False,
            status=AdapterStatus.ERROR,
            error=result.get("error", "Unknown error"),
            data=result,
        )
