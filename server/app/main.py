import json
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
from .realtime import initialize_realtime_session, open_realtime_socket
from .hospital import HospitalStore
from .intent_guard import IntentGuard



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



def create_app() -> FastAPI:
    settings = load_settings()
    storage_path = Path(__file__).resolve().parents[1] / "data" / "domains.json"
    registry = DomainRegistry(storage_path)
    hospital_store = HospitalStore(Path(__file__).resolve().parents[1] / "data" / "hospital.db")
    app = FastAPI(title="IVR Realtime Backend", version="1.0.0")

    # Allow local React dev server to call backend during development.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return JSONResponse({"status": "ok", "service": "ivr-backend"})
    
    @app.get("/api/hospital/doctors")
    async def list_hospital_doctors(specialty: str | None = None):
        return JSONResponse({"items": hospital_store.list_doctors(specialty)})

    @app.get("/api/hospital/slots")
    async def get_hospital_slots(
        visit_date: str,
        specialty: str | None = None,
        doctor_id: str | None = None,
    ):
        result = hospital_store.get_available_slots(
            visit_date=visit_date,
            specialty=specialty,
            doctor_id=doctor_id,
        )
        return JSONResponse(result)

    @app.post("/api/hospital/appointments/book")
    async def book_hospital_appointment(payload: AppointmentBookPayload):
        result = hospital_store.book_appointment(
            patient_name=payload.patient_name,
            phone_number=payload.phone_number,
            visit_date=payload.visit_date,
            slot_time=payload.slot_time,
            specialty=payload.specialty,
            doctor_id=payload.doctor_id,
            idempotency_key=payload.idempotency_key,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error", "Booking failed."))
        return JSONResponse(result)

    @app.get("/api/hospital/appointments/status")
    async def appointment_status(
        appointment_id: str | None = None,
        confirmation_code: str | None = None,
        phone_number: str | None = None,
        visit_date: str | None = None,
    ):
        result = hospital_store.get_appointment_status(
            appointment_id=appointment_id,
            confirmation_code=confirmation_code,
            phone_number=phone_number,
            visit_date=visit_date,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=404, detail=result.get("error", "Appointment not found."))
        return JSONResponse(result)


    @app.get("/api/speech/token")
    async def issue_speech_token():
        if not settings.azure_speech_api_key or not settings.azure_speech_region:
            raise HTTPException(
                status_code=500,
                detail="Azure Speech key/region missing in environment.",
            )

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
                token_url,
                method="POST",
                data=b"",
                headers={
                    "Ocp-Apim-Subscription-Key": settings.azure_speech_api_key,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": "0",
                },
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
            raise HTTPException(
                status_code=500,
                detail="Azure Speech key/region missing in environment.",
            )

        relay_url = (
            f"https://{settings.azure_speech_region}.tts.speech.microsoft.com"
            "/cognitiveservices/avatar/relay/token/v1"
        )
        request = Request(
            relay_url,
            method="GET",
            headers={
                "Ocp-Apim-Subscription-Key": settings.azure_speech_api_key,
            },
        )
        try:
            with urlopen(request, timeout=10) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Avatar relay token request failed with status {exc.code}.",
            ) from exc
        except URLError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Avatar relay token network error: {exc.reason}",
            ) from exc

        return JSONResponse(content=json.loads(body))

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
        return JSONResponse(saved.to_dict())

    @app.delete("/api/domains/{domain_id}")
    async def delete_domain(domain_id: str):
        deleted = registry.delete_domain(domain_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Domain not found.")
        return JSONResponse({"deleted": True, "domain_id": domain_id})

    @app.websocket("/ws")
    async def websocket_bridge(browser_ws: WebSocket):
        await browser_ws.accept()
        try:
            requested_domain = (browser_ws.query_params.get("domain") or "hospital").strip().lower()
            domain = registry.get_domain(requested_domain) or registry.get_domain("hospital")
            if domain is None:
                raise RuntimeError("No domain config available. Create at least one domain in /api/domains.")

            realtime_ws = await open_realtime_socket(settings)

            async with realtime_ws:
                await initialize_realtime_session(
                    realtime_ws,
                    settings,
                    system_prompt=build_system_prompt(domain),
                    welcome_message=domain.welcome_message,
                    voice=domain.voice,
                )
                intent_guard = IntentGuard(domain)
                await bridge_browser_with_realtime(browser_ws, realtime_ws, tool_handler=hospital_store.execute_tool, intent_guard=intent_guard)
        except WebSocketDisconnect:
            # Browser disconnected; avoid treating this as a backend failure.
            return
        except Exception as exc:  # noqa: BLE001 - return clean websocket error instead of traceback spam.
            if browser_ws.application_state == WebSocketState.CONNECTED:
                await browser_ws.send_json(
                    {
                        "type": "output_text",
                        "text": (
                            "Backend could not connect to Realtime API. "
                            "Check API keys, model access, and selected domain setup."
                        ),
                    }
                )
                await browser_ws.close()
            print(f"[backend] websocket bridge error: {exc}")

    return app
