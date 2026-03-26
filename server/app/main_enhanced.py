"""
Enhanced IVR Backend - Domain-Connected Intelligent IVR Platform
================================================================
Replaces hardcoded hospital logic with dynamic adapter-based routing.
Every IVR instance connects to its domain-specific backend through
the adapter framework.

Key enhancements:
1. Dynamic adapter resolution per domain
2. Configuration-driven tool loading
3. AI-powered intent classification
4. Integration router with retry/circuit-breaker
5. Multi-domain support without code changes
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.websockets import WebSocketDisconnect, WebSocketState

from .bridge import bridge_browser_with_realtime
from .config import load_settings
from .domains import DomainConfig, DomainRegistry
from .prompt import build_system_prompt
from .realtime_enhanced import initialize_realtime_session, open_realtime_socket
from .ai_intent_guard import AIIntentGuard

# Adapter framework
from .adapters import AdapterRegistry, IntegrationRouter
from .adapters.hospital_adapter import HospitalAdapter
from .adapters.banking_adapter import BankingAdapter
from .adapters.insurance_adapter import InsuranceAdapter
from .adapters.logistics_adapter import LogisticsAdapter
from .adapters.generic_adapter import GenericAdapter
from .adapters.domain_config_loader import (
    load_adapter_config_from_domain,
    load_all_adapter_configs,
)

logger = logging.getLogger(__name__)


# ── Pydantic Models ────────────────────────────────────────────────

class DomainPayload(BaseModel):
    domain_id: str = Field(min_length=2, max_length=64)
    display_name: str = Field(min_length=2, max_length=120)
    industry: str = Field(min_length=2, max_length=80)
    organization_name: str = Field(min_length=2, max_length=120)
    voice: str = "alloy"
    language: str = "English"
    welcome_message: str = Field(min_length=3, max_length=220)
    intents: list[str] = Field(default_factory=list)
    rules: list[str] = Field(default_factory=list)
    compliance: list[str] = Field(default_factory=list)
    escalation_message: str = Field(default="Connecting you to an operator.")
    active: bool = True
    adapter_config: dict | None = Field(default=None, description="Optional adapter override config")


class DomainGeneratePayload(BaseModel):
    domain_name: str = Field(min_length=2, max_length=120)
    organization_name: str | None = Field(default=None, max_length=120)


class AppointmentBookPayload(BaseModel):
    patient_name: str = Field(min_length=2, max_length=120)
    phone_number: str = Field(min_length=7, max_length=20)
    visit_date: str = Field(min_length=10, max_length=10, description="YYYY-MM-DD")
    slot_time: str = Field(min_length=5, max_length=5, description="HH:MM")
    specialty: str | None = Field(default=None, max_length=80)
    doctor_id: str | None = Field(default=None, max_length=80)
    idempotency_key: str | None = Field(default=None, max_length=120)


# ── Application Factory ───────────────────────────────────────────

def create_app() -> FastAPI:
    settings = load_settings()
    storage_path = Path(__file__).resolve().parents[1] / "data" / "domains.json"
    adapter_configs_dir = Path(__file__).resolve().parents[1] / "data" / "adapter_configs"
    registry = DomainRegistry(storage_path)

    # Initialize adapter framework
    adapter_registry = AdapterRegistry()

    # Register all available domain adapters (plug-and-play)
    adapter_registry.register("hospital", HospitalAdapter)
    adapter_registry.register("banking", BankingAdapter)
    adapter_registry.register("insurance", InsuranceAdapter)
    adapter_registry.register("logistics", LogisticsAdapter)
    adapter_registry.register("generic", GenericAdapter)

    # Create integration router
    integration_router = IntegrationRouter(adapter_registry)

    # Load any file-based adapter configs
    file_adapter_configs = load_all_adapter_configs(adapter_configs_dir)

    app = FastAPI(
        title="Cloud IVR Platform - Domain-Connected Intelligent IVR",
        version="2.0.0",
        description="Multi-tenant IVR platform with plug-and-play domain adapters",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Health & Monitoring ────────────────────────────────────────

    @app.get("/health")
    async def health():
        return JSONResponse({
            "status": "ok",
            "service": "ivr-backend",
            "version": "2.0.0",
            "registered_adapters": adapter_registry.list_registered_types(),
            "active_instances": adapter_registry.list_active_instances(),
        })

    @app.get("/api/adapters")
    async def list_adapters():
        """List all registered adapter types and active instances."""
        return JSONResponse({
            "registered_types": adapter_registry.list_registered_types(),
            "active_instances": adapter_registry.list_active_instances(),
        })

    @app.get("/api/adapters/{domain_id}/health")
    async def adapter_health(domain_id: str):
        """Check health of a domain's adapter connection."""
        domain = registry.get_domain(domain_id)
        if not domain:
            raise HTTPException(status_code=404, detail="Domain not found.")
        adapter_config = _resolve_adapter_config(domain)
        result = integration_router.health_check(domain_id, adapter_config)
        return JSONResponse(result)

    @app.get("/api/adapters/{domain_id}/tools")
    async def adapter_tools(domain_id: str):
        """Get the tool definitions for a domain's adapter."""
        domain = registry.get_domain(domain_id)
        if not domain:
            raise HTTPException(status_code=404, detail="Domain not found.")
        adapter_config = _resolve_adapter_config(domain)
        tools = integration_router.get_adapter_tools(domain_id, adapter_config)
        return JSONResponse({"domain_id": domain_id, "tools": tools})

    @app.get("/api/adapters/logs")
    async def adapter_logs(domain_id: str | None = None, limit: int = 50):
        """Get recent tool execution logs."""
        logs = integration_router.get_recent_logs(domain_id, limit)
        return JSONResponse({"items": logs})

    # ── Domain CRUD (preserved from original) ──────────────────────

    @app.get("/api/domains")
    async def list_domains():
        return JSONResponse({"items": [item.to_dict() for item in registry.list_domains()]})

    @app.get("/api/domains/{domain_id}")
    async def get_domain(domain_id: str):
        item = registry.get_domain(domain_id)
        if not item:
            raise HTTPException(status_code=404, detail="Domain not found.")
        return JSONResponse(item.to_dict())

    @app.post("/api/domains/generate")
    async def generate_domain(payload: DomainGeneratePayload):
        created = registry.generate_domain(payload.domain_name, payload.organization_name)
        return JSONResponse(created.to_dict())

    @app.put("/api/domains/{domain_id}")
    async def upsert_domain(domain_id: str, payload: DomainPayload):
        data = payload.model_dump()
        data["domain_id"] = domain_id
        current = registry.get_domain(domain_id)
        config = DomainConfig.from_dict(data)
        if current:
            config.created_at = current.created_at
        saved = registry.upsert_domain(config)
        # Invalidate cached adapter instance on config change
        adapter_registry.invalidate(domain_id)
        return JSONResponse(saved.to_dict())

    @app.delete("/api/domains/{domain_id}")
    async def delete_domain(domain_id: str):
        deleted = registry.delete_domain(domain_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Domain not found.")
        adapter_registry.invalidate(domain_id)
        return JSONResponse({"deleted": True, "domain_id": domain_id})

    # ── Speech Token (preserved) ───────────────────────────────────

    @app.get("/api/speech/token")
    async def issue_speech_token():
        if not settings.azure_speech_api_key or not settings.azure_speech_region:
            raise HTTPException(status_code=500, detail="Azure Speech key/region missing.")
        token_urls: list[str] = []
        if settings.azure_speech_endpoint:
            parsed = urlparse(settings.azure_speech_endpoint)
            host = parsed.netloc or settings.azure_speech_endpoint.replace("https://", "").replace("http://", "")
            token_urls.append(f"https://{host.rstrip('/')}/sts/v1.0/issueToken")
        token_urls.append(f"https://{settings.azure_speech_region}.api.cognitive.microsoft.com/sts/v1.0/issueToken")

        token = None
        errors: list[str] = []
        for token_url in token_urls:
            request = Request(
                token_url, method="POST", data=b"",
                headers={"Ocp-Apim-Subscription-Key": settings.azure_speech_api_key,
                          "Content-Type": "application/x-www-form-urlencoded", "Content-Length": "0"},
            )
            try:
                with urlopen(request, timeout=10) as response:
                    token = response.read().decode("utf-8")
                    break
            except HTTPError as exc:
                errors.append(f"{token_url} -> HTTP {exc.code}")
            except URLError as exc:
                errors.append(f"{token_url} -> network error: {exc.reason}")

        if not token:
            detail = "; ".join(errors) if errors else "unknown speech token failure"
            raise HTTPException(status_code=502, detail=f"Speech token request failed. {detail}")
        return JSONResponse({"token": token, "region": settings.azure_speech_region})

    @app.get("/api/speech/avatar-relay-token")
    async def issue_avatar_relay_token():
        if not settings.azure_speech_api_key or not settings.azure_speech_region:
            raise HTTPException(status_code=500, detail="Azure Speech key/region missing.")
        relay_url = (
            f"https://{settings.azure_speech_region}.tts.speech.microsoft.com"
            "/cognitiveservices/avatar/relay/token/v1"
        )
        request = Request(relay_url, method="GET",
                          headers={"Ocp-Apim-Subscription-Key": settings.azure_speech_api_key})
        try:
            with urlopen(request, timeout=10) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Avatar relay token failed: {exc.code}") from exc
        except URLError as exc:
            raise HTTPException(status_code=502, detail=f"Avatar relay token error: {exc.reason}") from exc
        return JSONResponse(content=json.loads(body))

    # ── Hospital-specific REST APIs (backward compatible) ──────────

    @app.get("/api/hospital/doctors")
    async def list_hospital_doctors(specialty: str | None = None):
        """Backward-compatible hospital API via adapter."""
        adapter_config = _resolve_adapter_config_for_industry("healthcare", "hospital")
        adapter = adapter_registry.get_adapter("hospital", adapter_config)
        if hasattr(adapter, '_get_local_store'):
            return JSONResponse({"items": adapter._get_local_store().list_doctors(specialty)})
        raise HTTPException(status_code=501, detail="Hospital adapter does not support direct doctor listing.")

    @app.get("/api/hospital/slots")
    async def get_hospital_slots(visit_date: str, specialty: str | None = None, doctor_id: str | None = None):
        adapter_config = _resolve_adapter_config_for_industry("healthcare", "hospital")
        result = integration_router.execute_tool("hospital", adapter_config, "get_available_slots", {
            "visit_date": visit_date, "specialty": specialty, "doctor_id": doctor_id,
        })
        return JSONResponse(result)

    @app.post("/api/hospital/appointments/book")
    async def book_hospital_appointment(payload: AppointmentBookPayload):
        adapter_config = _resolve_adapter_config_for_industry("healthcare", "hospital")
        result = integration_router.execute_tool("hospital", adapter_config, "book_appointment", payload.model_dump())
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error", "Booking failed."))
        return JSONResponse(result)

    @app.get("/api/hospital/appointments/status")
    async def appointment_status(
        appointment_id: str | None = None, confirmation_code: str | None = None,
        phone_number: str | None = None, visit_date: str | None = None,
    ):
        adapter_config = _resolve_adapter_config_for_industry("healthcare", "hospital")
        result = integration_router.execute_tool("hospital", adapter_config, "get_appointment_status", {
            "appointment_id": appointment_id, "confirmation_code": confirmation_code,
            "phone_number": phone_number, "visit_date": visit_date,
        })
        if not result.get("ok"):
            raise HTTPException(status_code=404, detail=result.get("error", "Not found."))
        return JSONResponse(result)

    # ── WebSocket Bridge (enhanced with dynamic adapters) ──────────

    @app.websocket("/ws")
    async def websocket_bridge(browser_ws: WebSocket):
        await browser_ws.accept()
        try:
            requested_domain = (browser_ws.query_params.get("domain") or "hospital").strip().lower()
            domain = registry.get_domain(requested_domain) or registry.get_domain("hospital")
            if domain is None:
                raise RuntimeError("No domain config available.")

            # Resolve adapter config for this domain
            adapter_config = _resolve_adapter_config(domain)

            # Get tools dynamically from the adapter
            tools = integration_router.get_adapter_tools(domain.domain_id, adapter_config)

            # Create domain-specific tool handler
            tool_handler = integration_router.create_tool_handler(domain.domain_id, adapter_config)

            # Open realtime connection
            realtime_ws = await open_realtime_socket(settings)

            async with realtime_ws:
                # Initialize session with dynamic tools
                await initialize_realtime_session(
                    realtime_ws,
                    settings,
                    system_prompt=build_system_prompt(domain),
                    welcome_message=domain.welcome_message,
                    voice=domain.voice,
                    tools=tools,  # Dynamic tools from adapter!
                )

                # Use AI-powered intent guard
                intent_guard = AIIntentGuard(domain, use_ai=True)

                # Bridge with dynamic tool handler
                await bridge_browser_with_realtime(
                    browser_ws,
                    realtime_ws,
                    tool_handler=tool_handler,  # Dynamic adapter-based handler!
                    intent_guard=intent_guard,
                )
        except WebSocketDisconnect:
            return
        except Exception as exc:
            if browser_ws.application_state == WebSocketState.CONNECTED:
                await browser_ws.send_json({
                    "type": "output_text",
                    "text": (
                        "Backend could not connect to Realtime API. "
                        "Check API keys, model access, and selected domain setup."
                    ),
                })
                await browser_ws.close()
            logger.error(f"[backend] websocket bridge error: {exc}")

    # ── Helper Functions ───────────────────────────────────────────

    def _resolve_adapter_config(domain: DomainConfig):
        """Resolve the adapter config for a domain, checking file configs first."""
        # Check file-based configs
        if domain.domain_id in file_adapter_configs:
            return file_adapter_configs[domain.domain_id]
        # Auto-infer from domain metadata
        return load_adapter_config_from_domain(
            domain_id=domain.domain_id,
            industry=domain.industry,
            organization_name=domain.organization_name,
        )

    def _resolve_adapter_config_for_industry(industry: str, domain_id: str):
        """Resolve adapter config for backward-compatible APIs."""
        if domain_id in file_adapter_configs:
            return file_adapter_configs[domain_id]
        return load_adapter_config_from_domain(
            domain_id=domain_id,
            industry=industry,
            organization_name="",
        )

    return app
