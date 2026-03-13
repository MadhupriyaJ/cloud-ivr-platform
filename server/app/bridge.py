from __future__ import annotations
import asyncio
import json
from typing import Callable

from fastapi import WebSocket, WebSocketDisconnect
from websockets.exceptions import ConnectionClosed

from .intent_guard import IntentGuard


async def bridge_browser_with_realtime(
    browser_ws: WebSocket,
    realtime_ws,
    tool_handler: Callable[[str, dict], dict] | None = None,
    intent_guard: IntentGuard | None = None,
) -> None:
    forward_task = asyncio.create_task(_forward_browser_audio(browser_ws, realtime_ws))
    return_task = asyncio.create_task(
        _forward_realtime_events(browser_ws, realtime_ws, tool_handler, intent_guard)
    )

    done, pending = await asyncio.wait({forward_task, return_task}, return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
    for task in done:
        exc = task.exception()
        if exc:
            raise exc


async def _forward_browser_audio(browser_ws: WebSocket, realtime_ws) -> None:
    try:
        while True:
            raw = await browser_ws.receive_text()
            message = json.loads(raw)

            if message.get("type") == "input_audio" and message.get("audio"):
                await realtime_ws.send(
                    json.dumps(
                        {
                            "type": "input_audio_buffer.append",
                            "audio": message["audio"],
                        }
                    )
                )
    except (WebSocketDisconnect, ConnectionClosed):
        return


async def _forward_realtime_events(
    browser_ws: WebSocket,
    realtime_ws,
    tool_handler,
    intent_guard: IntentGuard | None = None,
) -> None:
    blocked_turn = False
    fallback_reply = intent_guard.out_of_scope_reply() if intent_guard else "I can help only with allowed options. Say operator."

    try:
        async for raw in realtime_ws:
            event = json.loads(raw)
            event_type = event.get("type")

            if event_type == "input_audio_buffer.speech_started":
                blocked_turn = False
                continue

            # Gate decision happens here, before response.create.
            if event_type == "conversation.item.input_audio_transcription.completed":
                transcript = (event.get("transcript") or "").strip()
                if intent_guard:
                    decision = intent_guard.decide(transcript)
                    if decision.in_scope:
                        await realtime_ws.send(json.dumps({"type": "response.create"}))
                    else:
                        blocked_turn = True
                        await realtime_ws.send(json.dumps({
                            "type": "response.create",
                            "response": {
                                "modalities": ["text", "audio"],
                                "instructions": f"Say exactly this sentence and nothing else: {fallback_reply}",
                            },
                        }))
                else:
                    await realtime_ws.send(json.dumps({"type": "response.create"}))
                continue

            if event_type in {"response.text.delta", "response.output_text.delta"} and event.get("delta"):
                await browser_ws.send_text(json.dumps({"type": "output_text", "text": event["delta"]}))
                continue

            if event_type == "response.audio.delta" and event.get("delta"):
                await browser_ws.send_text(json.dumps({"type": "output_audio", "audio": event["delta"]}))
                continue

            if event_type == "response.done":
                await browser_ws.send_text(json.dumps({"type": "output_text_done"}))
                continue

            # Ignore tools for blocked turns.
            if blocked_turn and event_type in {"response.function_call_arguments.done", "response.output_item.done"}:
                continue

            if event_type == "response.function_call_arguments.done" and tool_handler:
                tool_name = event.get("name")
                call_id = event.get("call_id")
                args = json.loads(event.get("arguments") or "{}")
                result = tool_handler(tool_name, args)

                await realtime_ws.send(json.dumps({
                    "type": "conversation.item.create",
                    "item": {"type": "function_call_output", "call_id": call_id, "output": json.dumps(result)},
                }))
                await realtime_ws.send(json.dumps({"type": "response.create"}))
                continue

            if event_type == "response.output_item.done" and tool_handler:
                item = event.get("item") or {}
                if item.get("type") == "function_call":
                    tool_name = item.get("name")
                    call_id = item.get("call_id")
                    args = json.loads(item.get("arguments") or "{}")
                    result = tool_handler(tool_name, args)

                    await realtime_ws.send(json.dumps({
                        "type": "conversation.item.create",
                        "item": {"type": "function_call_output", "call_id": call_id, "output": json.dumps(result)},
                    }))
                    await realtime_ws.send(json.dumps({"type": "response.create"}))
                    continue

    except (WebSocketDisconnect, RuntimeError, ConnectionClosed):
        return


# from __future__ import annotations

# import asyncio
# import json

# from fastapi import WebSocket, WebSocketDisconnect


# async def bridge_browser_with_realtime(browser_ws: WebSocket, realtime_ws) -> None:
#     # Run browser->realtime and realtime->browser pipes together.
#     forward_task = asyncio.create_task(
#         _forward_browser_audio(browser_ws, realtime_ws)
#     )
#     return_task = asyncio.create_task(
#         _forward_realtime_events(browser_ws, realtime_ws)
#     )

#     done, pending = await asyncio.wait(
#         {forward_task, return_task},
#         return_when=asyncio.FIRST_COMPLETED,
#     )
#     for task in pending:
#         task.cancel()
#     for task in done:
#         exc = task.exception()
#         if exc:
#             raise exc


# async def _forward_browser_audio(browser_ws: WebSocket, realtime_ws) -> None:
#     # Browser sends JSON payload: {"type":"input_audio","audio":"<base64 pcm16>"}
#     try:
#         while True:
#             raw = await browser_ws.receive_text()
#             message = json.loads(raw)

#             if message.get("type") == "input_audio" and message.get("audio"):
#                 await realtime_ws.send(
#                     json.dumps(
#                         {
#                             "type": "input_audio_buffer.append",
#                             "audio": message["audio"],
#                         }
#                     )
#                 )
#     except WebSocketDisconnect:
#         # Browser closed the websocket; this is a normal end-of-call path.
#         return


# async def _forward_realtime_events(browser_ws: WebSocket, realtime_ws) -> None:
#     # Only pass necessary event types to keep client parsing simple.
#     try:
#         async for raw in realtime_ws:
#             event = json.loads(raw)
#             event_type = event.get("type")

#             if event_type == "response.done":
#                 await browser_ws.send_text(json.dumps({"type": "output_text_done"}))
#                 continue

#             if event_type == "response.audio.delta" and event.get("delta"):
#                 await browser_ws.send_text(
#                     json.dumps(
#                         {
#                             "type": "output_audio",
#                             "audio": event["delta"],
#                         }
#                     )
#                 )
#                 continue

#             if event_type == "response.text.delta" and event.get("delta"):
#                 await browser_ws.send_text(
#                     json.dumps(
#                         {
#                             "type": "output_text",
#                             "text": event["delta"],
#                         }
#                     )
#                 )
#                 continue

#             # Some realtime deployments emit assistant transcript on audio_transcript events.
#             if event_type == "response.audio_transcript.delta" and event.get("delta"):
#                 await browser_ws.send_text(
#                     json.dumps(
#                         {
#                             "type": "output_text",
#                             "text": event["delta"],
#                         }
#                     )
#                 )
#     except (WebSocketDisconnect, RuntimeError):
#         # Browser socket may close before realtime stream finishes.
#         return
