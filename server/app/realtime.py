from __future__ import annotations

import json
from urllib.parse import urlparse

import websockets

from .config import Settings

HOSPITAL_TOOLS = [
    {
        "type": "function",
        "name": "verify_patient",
        "description": "Verify patient using phone number (demo), optionally DOB or MRN.",
        "parameters": {
            "type": "object",
            "properties": {
                "phone_number": {"type": "string"},
                "dob": {"type": "string", "description": "YYYY-MM-DD"},
                "mrn": {"type": "string"},
            },
            "required": ["phone_number"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "get_available_slots",
        "description": "Get doctor-wise available appointment slots for a date.",
        "parameters": {
            "type": "object",
            "properties": {
                "visit_date": {"type": "string", "description": "YYYY-MM-DD"},
                "specialty": {"type": "string"},
                "doctor_id": {"type": "string"},
            },
            "required": ["visit_date"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "book_appointment",
        "description": "Book a confirmed appointment slot for a patient.",
        "parameters": {
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
    },
    {
        "type": "function",
        "name": "get_appointment_status",
        "description": "Check appointment confirmation/status.",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string"},
                "confirmation_code": {"type": "string"},
                "phone_number": {"type": "string"},
                "visit_date": {"type": "string", "description": "YYYY-MM-DD"},
            },
            "additionalProperties": False,
        },
    },
]


def _candidate_ws_bases(endpoint: str) -> list[str]:
    """
    Build likely websocket base URLs from a configured Azure endpoint.

    Why:
    - Some environments store endpoint as `*.cognitiveservices.azure.com`
    - Realtime websocket generally expects `*.openai.azure.com`
    """
    endpoint = endpoint.rstrip("/")
    parsed = urlparse(endpoint)
    host = parsed.netloc or endpoint.replace("https://", "").replace("http://", "")
    scheme = "wss"
    bases: list[str] = []

    # Keep original host first.
    bases.append(f"{scheme}://{host}")

    # Add converted OpenAI host when endpoint is cognitive-services style.
    if host.endswith(".cognitiveservices.azure.com"):
        resource = host.split(".")[0]
        bases.append(f"{scheme}://{resource}.openai.azure.com")

    # Deduplicate while preserving order.
    unique: list[str] = []
    for base in bases:
        if base not in unique:
            unique.append(base)
    return unique


def _build_realtime_connection(settings: Settings) -> tuple[list[tuple[str, dict]], tuple[str, dict] | None]:
    # Prefer Azure Realtime when Azure credentials are available.
    if (
        settings.azure_openai_api_key
        and settings.azure_openai_endpoint
        and settings.azure_openai_deployment
    ):
        deployment = settings.azure_openai_deployment.strip()
        api_version = settings.azure_openai_api_version
        preview_api_version = api_version if api_version.endswith("-preview") else "2025-01-01-preview"
        ws_bases = _candidate_ws_bases(settings.azure_openai_endpoint)

        preview_headers = {
            "api-key": settings.azure_openai_api_key,
            "OpenAI-Beta": "realtime=v1",
        }
        ga_headers = {"api-key": settings.azure_openai_api_key}
        primary_urls: list[tuple[str, dict]] = []

        for ws_base in ws_bases:
            preview_url = (
                f"{ws_base}/openai/realtime"
                f"?api-version={preview_api_version}"
                f"&deployment={deployment}"
            )
            ga_url = f"{ws_base}/openai/v1/realtime?model={deployment}"

            if api_version.endswith("-preview"):
                primary_urls.append((preview_url, preview_headers))
                primary_urls.append((ga_url, ga_headers))
            else:
                primary_urls.append((ga_url, ga_headers))
                primary_urls.append((preview_url, preview_headers))
        return primary_urls, None

    if settings.openai_api_key:
        ws_url = f"wss://api.openai.com/v1/realtime?model={settings.openai_realtime_model}"
        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "OpenAI-Beta": "realtime=v1",
        }
        return [(ws_url, headers)], None

    raise ValueError(
        "Missing API config. Set OPENAI_API_KEY or "
        "(AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT)."
    )


async def open_realtime_socket(settings: Settings):
    primary, fallback = _build_realtime_connection(settings)
    attempts = primary + ([fallback] if fallback else [])
    last_error = None

    for url, headers in attempts:
        try:
            print(f"[realtime] trying websocket endpoint: {url}")
            return await websockets.connect(url, additional_headers=headers)
        except Exception as exc:  # noqa: BLE001 - retry all transport-related failures.
            last_error = exc
            print(f"[realtime] connection failed: {exc}")

    raise RuntimeError(f"Realtime websocket connect failed: {last_error}")


async def initialize_realtime_session(
    realtime_ws,
    settings: Settings,
    *,
    system_prompt: str,
    welcome_message: str,
    voice: str | None = None,
) -> None:
    # Session update keeps model deterministic and concise for IVR behavior.
    session = {
        "type": "session.update",
        "session": {
            "turn_detection": {
                "type": "server_vad",
                # Faster and more natural turn-taking.
                "threshold": 0.58,
                "silence_duration_ms": 150,
                "prefix_padding_ms": 120,
                "create_response": False,  # IMPORTANT: disable auto-response so backend can run intent gate first.
            },

            # Transcribe caller utterance so backend can classify intent deterministically.
            "input_audio_transcription": {"model": "gpt-4o-mini-transcribe"},
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "voice": voice or settings.voice,
            "instructions": system_prompt,
            "modalities": ["text", "audio"],
            "tools": HOSPITAL_TOOLS,
            "tool_choice": "auto",
            # Keep replies complete and stable for IVR routing.
            "max_response_output_tokens": 96,
            "temperature": 0.1,
        },
    }
    await realtime_ws.send(json.dumps(session))

    # Clear any stale buffered audio before first turn.
    await realtime_ws.send(json.dumps({"type": "input_audio_buffer.clear"}))

    # Hard lock first greeting to exact text.
    greeting_response = {
        "type": "response.create",
        "response": {
            "modalities": ["text", "audio"],
            "instructions": f"Say exactly this sentence and nothing else: {welcome_message}",
        },
    }
    await realtime_ws.send(json.dumps(greeting_response))
