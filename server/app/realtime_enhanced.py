"""
Enhanced Realtime Session Manager
==================================
Replaces the hardcoded HOSPITAL_TOOLS with dynamic tool loading
from domain adapters. Tools are resolved at session initialization
based on the domain's adapter configuration.

Key changes from original realtime.py:
1. Tools loaded dynamically from adapter, not hardcoded
2. Session initialization accepts tools parameter
3. Supports any domain, not just hospital
"""

from __future__ import annotations

import json
import logging
from urllib.parse import urlparse

import websockets

from .config import Settings

logger = logging.getLogger(__name__)


def _candidate_ws_bases(endpoint: str) -> list[str]:
    """
    Build likely websocket base URLs from a configured Azure endpoint.
    """
    endpoint = endpoint.rstrip("/")
    parsed = urlparse(endpoint)
    host = parsed.netloc or endpoint.replace("https://", "").replace("http://", "")
    scheme = "wss"
    bases: list[str] = []

    bases.append(f"{scheme}://{host}")

    if host.endswith(".cognitiveservices.azure.com"):
        resource = host.split(".")[0]
        bases.append(f"{scheme}://{resource}.openai.azure.com")

    unique: list[str] = []
    for base in bases:
        if base not in unique:
            unique.append(base)
    return unique


def _build_realtime_connection(settings: Settings) -> tuple[list[tuple[str, dict]], tuple[str, dict] | None]:
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
            logger.info(f"[realtime] trying websocket endpoint: {url}")
            return await websockets.connect(url, additional_headers=headers)
        except Exception as exc:
            last_error = exc
            logger.warning(f"[realtime] connection failed: {exc}")

    raise RuntimeError(f"Realtime websocket connect failed: {last_error}")


async def initialize_realtime_session(
    realtime_ws,
    settings: Settings,
    *,
    system_prompt: str,
    welcome_message: str,
    voice: str | None = None,
    tools: list[dict] | None = None,
) -> None:
    """
    Initialize a realtime session with dynamic tools.

    Args:
        realtime_ws: The websocket connection to the realtime API
        settings: Application settings
        system_prompt: The system prompt for this domain
        welcome_message: The greeting message
        voice: Voice to use (default from settings)
        tools: List of OpenAI tool definitions (loaded from adapter).
               If None, no tools are registered (conversational-only mode).
    """
    session_config: dict = {
        "turn_detection": {
            "type": "server_vad",
            "threshold": 0.58,
            "silence_duration_ms": 150,
            "prefix_padding_ms": 120,
            "create_response": False,
        },
        "input_audio_transcription": {"model": "gpt-4o-mini-transcribe"},
        "input_audio_format": "pcm16",
        "output_audio_format": "pcm16",
        "voice": voice or settings.voice,
        "instructions": system_prompt,
        "modalities": ["text", "audio"],
        "max_response_output_tokens": 96,
        "temperature": 0.1,
    }

    # Dynamically inject tools from the domain adapter
    if tools:
        session_config["tools"] = tools
        session_config["tool_choice"] = "auto"
        logger.info(f"[realtime] Registered {len(tools)} tools: {[t['name'] for t in tools]}")
    else:
        logger.info("[realtime] No tools registered (conversational-only mode).")

    session_update = {
        "type": "session.update",
        "session": session_config,
    }
    await realtime_ws.send(json.dumps(session_update))

    # Clear stale audio buffer
    await realtime_ws.send(json.dumps({"type": "input_audio_buffer.clear"}))

    # Force exact greeting
    greeting_response = {
        "type": "response.create",
        "response": {
            "modalities": ["text", "audio"],
            "instructions": f"Say exactly this sentence and nothing else: {welcome_message}",
        },
    }
    await realtime_ws.send(json.dumps(greeting_response))
