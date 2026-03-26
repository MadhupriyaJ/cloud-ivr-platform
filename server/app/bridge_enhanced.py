"""
Enhanced WebSocket Bridge
=========================
Bridges browser WebSocket with OpenAI Realtime API.
Enhanced to work with dynamic domain adapters and AI intent guard.

Key changes from original bridge.py:
1. tool_handler is now a generic callable (from IntegrationRouter)
2. intent_guard is now AIIntentGuard (Gen AI-powered)
3. Supports any domain's tools, not just hospital
4. Added analytics tracking
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any, Callable

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


async def bridge_browser_with_realtime(
    browser_ws: WebSocket,
    realtime_ws,
    *,
    tool_handler: Callable[[str, dict], dict],
    intent_guard: Any = None,
) -> None:
    """
    Bidirectional bridge between browser WebSocket and OpenAI Realtime API.

    Args:
        browser_ws: The browser-side WebSocket connection
        realtime_ws: The OpenAI Realtime API WebSocket connection
        tool_handler: A callable that executes tool calls (from IntegrationRouter)
        intent_guard: An AIIntentGuard instance for intent classification
    """

    pending_tool_calls: dict[str, dict] = {}
    last_transcript: str = ""
    conversation_active = True

    async def _browser_to_realtime():
        """Forward browser audio/events to Realtime API."""
        nonlocal last_transcript
        try:
            while conversation_active:
                raw = await browser_ws.receive_text()
                msg = json.loads(raw)
                msg_type = msg.get("type", "")

                if msg_type == "input_audio_buffer.append":
                    await realtime_ws.send(raw)
                elif msg_type == "input_audio_buffer.commit":
                    await realtime_ws.send(raw)
                elif msg_type == "response.create":
                    await realtime_ws.send(raw)
                elif msg_type == "conversation.item.create":
                    await realtime_ws.send(raw)
                else:
                    # Forward unknown types
                    await realtime_ws.send(raw)
        except Exception as exc:
            logger.debug(f"[bridge] browser→realtime ended: {exc}")

    async def _realtime_to_browser():
        """Forward Realtime API events to browser, handling tool calls."""
        nonlocal last_transcript, conversation_active
        try:
            async for raw in realtime_ws:
                msg = json.loads(raw)
                msg_type = msg.get("type", "")

                # Track transcripts for intent guard
                if msg_type == "conversation.item.input_audio_transcription.completed":
                    transcript = msg.get("transcript", "")
                    if transcript:
                        last_transcript = transcript
                        # Send transcript to browser for display
                        await _safe_send_browser(browser_ws, {
                            "type": "input_transcript",
                            "text": transcript,
                        })

                # Handle tool calls from the AI
                elif msg_type == "response.function_call_arguments.done":
                    call_id = msg.get("call_id", "")
                    tool_name = msg.get("name", "")
                    args_str = msg.get("arguments", "{}")

                    try:
                        args = json.loads(args_str)
                    except json.JSONDecodeError:
                        args = {}

                    logger.info(f"[bridge] Tool call: {tool_name}({json.dumps(args)[:200]})")

                    # Execute tool through the adapter integration router
                    try:
                        result = tool_handler(tool_name, args)
                    except Exception as exc:
                        logger.error(f"[bridge] Tool execution error: {exc}")
                        result = {
                            "ok": False,
                            "error": f"Tool execution failed: {exc}",
                            "message": "I'm having trouble with that request. Let me try again.",
                        }

                    # Send tool result back to Realtime API
                    tool_output = {
                        "type": "conversation.item.create",
                        "item": {
                            "type": "function_call_output",
                            "call_id": call_id,
                            "output": json.dumps(result),
                        },
                    }
                    await realtime_ws.send(json.dumps(tool_output))

                    # Trigger AI to respond with the tool result
                    await realtime_ws.send(json.dumps({"type": "response.create"}))

                    # Notify browser about tool execution
                    await _safe_send_browser(browser_ws, {
                        "type": "tool_executed",
                        "tool_name": tool_name,
                        "ok": result.get("ok", False),
                    })

                # Handle speech-to-text completed (for intent guard)
                elif msg_type == "input_audio_buffer.speech_stopped":
                    # Speech ended, commit and create response
                    await realtime_ws.send(json.dumps({"type": "input_audio_buffer.commit"}))

                    # Apply intent guard if available
                    if intent_guard and last_transcript:
                        decision = intent_guard.decide(last_transcript)
                        if not decision.in_scope:
                            # Out of scope - inject guard response
                            guard_msg = intent_guard.out_of_scope_reply()
                            await realtime_ws.send(json.dumps({
                                "type": "response.create",
                                "response": {
                                    "modalities": ["text", "audio"],
                                    "instructions": f"Say exactly: {guard_msg}",
                                },
                            }))
                            last_transcript = ""
                            continue

                    await realtime_ws.send(json.dumps({"type": "response.create"}))
                    last_transcript = ""

                # Forward audio and text output to browser
                elif msg_type == "response.audio.delta":
                    await _safe_send_browser(browser_ws, msg)

                elif msg_type == "response.audio_transcript.delta":
                    await _safe_send_browser(browser_ws, {
                        "type": "output_text_delta",
                        "delta": msg.get("delta", ""),
                    })

                elif msg_type == "response.audio_transcript.done":
                    await _safe_send_browser(browser_ws, {
                        "type": "output_text",
                        "text": msg.get("transcript", ""),
                    })

                elif msg_type == "response.done":
                    await _safe_send_browser(browser_ws, {"type": "response_done"})

                elif msg_type == "error":
                    error_msg = msg.get("error", {}).get("message", "Unknown error")
                    logger.error(f"[bridge] Realtime API error: {error_msg}")
                    await _safe_send_browser(browser_ws, {
                        "type": "error",
                        "message": error_msg,
                    })

        except Exception as exc:
            logger.debug(f"[bridge] realtime→browser ended: {exc}")
        finally:
            conversation_active = False

    # Run both directions concurrently
    await asyncio.gather(
        _browser_to_realtime(),
        _realtime_to_browser(),
        return_exceptions=True,
    )


async def _safe_send_browser(browser_ws: WebSocket, data: dict) -> None:
    """Send data to browser WebSocket, handling disconnection gracefully."""
    try:
        if browser_ws.application_state == WebSocketState.CONNECTED:
            await browser_ws.send_json(data)
    except Exception:
        pass
