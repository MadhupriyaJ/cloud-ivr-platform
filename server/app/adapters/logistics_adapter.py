"""
Logistics Domain Adapter
========================
Connects IVR to Logistics/Shipping Management System.
Handles: shipment tracking, delivery scheduling, pickup requests,
complaint registration, rate enquiry.
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


class LogisticsAdapter(BaseDomainAdapter):
    """
    Domain adapter for Logistics and Shipping Management Systems.

    Tools exposed:
    - track_shipment: Track a shipment by AWB/tracking number
    - schedule_pickup: Schedule a package pickup
    - get_delivery_estimate: Get estimated delivery date
    - register_complaint: Register a delivery complaint
    - get_rate_estimate: Get shipping rate estimate
    """

    def __init__(self, config: AdapterConfig):
        super().__init__(config)

    @property
    def _is_demo_mode(self) -> bool:
        return not self.config.api_base_url

    def get_tool_definitions(self) -> list[AdapterToolDefinition]:
        return [
            AdapterToolDefinition(
                name="track_shipment",
                description="Track a shipment using AWB number or tracking ID.",
                parameters={
                    "type": "object",
                    "properties": {
                        "tracking_number": {"type": "string", "description": "AWB or tracking number"},
                        "phone_number": {"type": "string"},
                    },
                    "required": ["tracking_number"],
                    "additionalProperties": False,
                },
                handler_method="handle_track_shipment",
            ),
            AdapterToolDefinition(
                name="schedule_pickup",
                description="Schedule a package pickup from the caller's address.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "pickup_address": {"type": "string"},
                        "pickup_date": {"type": "string", "description": "YYYY-MM-DD"},
                        "pickup_time_slot": {"type": "string", "description": "morning, afternoon, evening"},
                        "package_type": {"type": "string", "description": "document, parcel, heavy"},
                    },
                    "required": ["phone_number", "pickup_address", "pickup_date"],
                    "additionalProperties": False,
                },
                handler_method="handle_schedule_pickup",
            ),
            AdapterToolDefinition(
                name="get_delivery_estimate",
                description="Get estimated delivery date for a shipment.",
                parameters={
                    "type": "object",
                    "properties": {
                        "origin_pincode": {"type": "string"},
                        "destination_pincode": {"type": "string"},
                        "service_type": {"type": "string", "description": "express, standard, economy"},
                    },
                    "required": ["origin_pincode", "destination_pincode"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_delivery_estimate",
            ),
            AdapterToolDefinition(
                name="register_complaint",
                description="Register a complaint about a delivery or shipment.",
                parameters={
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "tracking_number": {"type": "string"},
                        "complaint_type": {"type": "string", "description": "delayed, damaged, missing, wrong_delivery"},
                        "description": {"type": "string"},
                    },
                    "required": ["phone_number", "complaint_type"],
                    "additionalProperties": False,
                },
                handler_method="handle_register_complaint",
            ),
            AdapterToolDefinition(
                name="get_rate_estimate",
                description="Get shipping rate estimate based on origin, destination, and weight.",
                parameters={
                    "type": "object",
                    "properties": {
                        "origin_pincode": {"type": "string"},
                        "destination_pincode": {"type": "string"},
                        "weight_kg": {"type": "string"},
                        "service_type": {"type": "string", "description": "express, standard, economy"},
                    },
                    "required": ["origin_pincode", "destination_pincode", "weight_kg"],
                    "additionalProperties": False,
                },
                handler_method="handle_get_rate_estimate",
            ),
        ]

    def execute_tool(self, tool_name: str, args: dict[str, Any]) -> AdapterResponse:
        self.ensure_authenticated()
        return self._dispatch_tool(tool_name, args)

    def health_check(self) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(ok=True, status=AdapterStatus.SUCCESS, message="Logistics demo mode healthy.")
        return self._api_get("/health")

    def authenticate(self) -> bool:
        self._authenticated = True
        return True

    # ── Tool Handlers ──────────────────────────────────────────────

    def handle_track_shipment(self, tracking_number: str = "", phone_number: str = "", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"tracking_number": tracking_number, "status": "in_transit",
                       "current_location": "Mumbai Hub", "last_update": "2026-03-26 08:30 AM",
                       "expected_delivery": "2026-03-28",
                       "message": f"Your shipment {tracking_number} is in transit at Mumbai Hub. Expected delivery by March 28."},
                message="Shipment tracked.",
            )
        return self._api_get("/api/logistics/track", {"tracking_number": tracking_number})

    def handle_schedule_pickup(self, phone_number: str = "", pickup_address: str = "",
                                pickup_date: str = "", pickup_time_slot: str = "morning",
                                package_type: str = "parcel", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            import uuid
            pickup_id = f"PKP-{uuid.uuid4().hex[:8].upper()}"
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"pickup_id": pickup_id, "pickup_date": pickup_date,
                       "time_slot": pickup_time_slot, "status": "scheduled",
                       "message": f"Pickup {pickup_id} scheduled for {pickup_date} ({pickup_time_slot}). Our agent will call before arriving."},
                message="Pickup scheduled.",
            )
        return self._api_post("/api/logistics/pickups/schedule", {
            "phone_number": phone_number, "pickup_address": pickup_address,
            "pickup_date": pickup_date, "pickup_time_slot": pickup_time_slot, "package_type": package_type,
        })

    def handle_get_delivery_estimate(self, origin_pincode: str = "", destination_pincode: str = "",
                                      service_type: str = "standard", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            days = {"express": "1-2", "standard": "3-5", "economy": "5-7"}.get(service_type, "3-5")
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"origin": origin_pincode, "destination": destination_pincode,
                       "service": service_type, "estimated_days": days,
                       "message": f"Estimated delivery: {days} business days for {service_type} service."},
                message="Delivery estimate provided.",
            )
        return self._api_get("/api/logistics/estimates/delivery", {
            "origin_pincode": origin_pincode, "destination_pincode": destination_pincode, "service_type": service_type,
        })

    def handle_register_complaint(self, phone_number: str = "", tracking_number: str = "",
                                   complaint_type: str = "", description: str = "", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            import uuid
            complaint_id = f"CMP-{uuid.uuid4().hex[:8].upper()}"
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"complaint_id": complaint_id, "complaint_type": complaint_type, "status": "registered",
                       "message": f"Complaint {complaint_id} registered. Our team will resolve within 48 hours."},
                message="Complaint registered.",
            )
        return self._api_post("/api/logistics/complaints", {
            "phone_number": phone_number, "tracking_number": tracking_number,
            "complaint_type": complaint_type, "description": description,
        })

    def handle_get_rate_estimate(self, origin_pincode: str = "", destination_pincode: str = "",
                                  weight_kg: str = "1", service_type: str = "standard", **kwargs) -> AdapterResponse:
        if self._is_demo_mode:
            base_rates = {"express": 150, "standard": 80, "economy": 50}
            base = base_rates.get(service_type, 80)
            try:
                weight = float(weight_kg)
            except ValueError:
                weight = 1.0
            rate = base + (weight * 20)
            return AdapterResponse(
                ok=True, status=AdapterStatus.SUCCESS,
                data={"origin": origin_pincode, "destination": destination_pincode,
                       "weight_kg": weight_kg, "service": service_type,
                       "estimated_rate": f"{rate:.0f}", "currency": "INR",
                       "message": f"Estimated shipping rate: INR {rate:.0f} for {weight_kg} kg ({service_type})."},
                message="Rate estimate provided.",
            )
        return self._api_get("/api/logistics/estimates/rate", {
            "origin_pincode": origin_pincode, "destination_pincode": destination_pincode,
            "weight_kg": weight_kg, "service_type": service_type,
        })

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
