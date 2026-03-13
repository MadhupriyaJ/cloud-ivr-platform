import os
import json
import base64
import asyncio
from pathlib import Path
import websockets
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import HTMLResponse
from fastapi.websockets import WebSocketDisconnect
from twilio.twiml.voice_response import VoiceResponse, Connect, Say, Stream
from dotenv import load_dotenv
import uvicorn

# Always load .env from the same directory as this file.
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview-2024-10-01")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-01-preview")
HOSPITAL_NAME = os.getenv("HOSPITAL_NAME", "City Care Hospital")

SYSTEM_MESSAGE = (
    f"You are the voice IVR assistant for {HOSPITAL_NAME}. "
    "Handle hospital call routing and first-level support. "
    "Speak clearly, politely, and briefly. "
    "Support intents: appointment booking or rescheduling, doctor availability, "
    "department details, lab report status, billing, and operator handoff. "
    "Start by identifying caller intent in one short question, then guide one step at a time. "
    "Collect and confirm key details: patient name, phone number, department, preferred date and time, "
    "and reason for visit. "
    "If caller reports chest pain, heavy bleeding, breathing trouble, stroke signs, or any life-threatening issue, "
    "immediately advise emergency services or nearest emergency room. "
    "Do not provide diagnosis or prescriptions. "
    "If request is unclear, offer options: appointments, lab reports, billing, or operator."
)
VOICE = 'alloy'
LOG_EVENT_TYPES = [
    'response.content.done', 'rate_limits.updated', 'response.done',
    'input_audio_buffer.committed', 'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started', 'session.created'
]
app = FastAPI()
if not OPENAI_API_KEY and not (AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT):
    raise ValueError(
        "Missing API config. Set either OPENAI_API_KEY or "
        "(AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT) in .env."
    )

if AZURE_OPENAI_ENDPOINT and "<" in AZURE_OPENAI_ENDPOINT:
    raise ValueError(
        "AZURE_OPENAI_ENDPOINT still has placeholder text. "
        "Set it like: https://YOUR_RESOURCE_NAME.openai.azure.com"
    )

if AZURE_OPENAI_DEPLOYMENT and "<" in AZURE_OPENAI_DEPLOYMENT:
    raise ValueError(
        "AZURE_OPENAI_DEPLOYMENT still has placeholder text. "
        "Set it to your Azure OpenAI realtime deployment name."
    )


def build_realtime_connection():
    """Return primary and fallback websocket configs."""
    if AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT:
        endpoint = AZURE_OPENAI_ENDPOINT.rstrip("/")
        ws_base = endpoint.replace("https://", "wss://")
        api_version = (AZURE_OPENAI_API_VERSION or "").strip()
        deployment = AZURE_OPENAI_DEPLOYMENT.strip()
        preview_api_version = api_version if api_version.endswith("-preview") else "2025-01-01-preview"
        preview_url = (
            f"{ws_base}/openai/realtime"
            f"?api-version={preview_api_version}"
            f"&deployment={deployment}"
        )
        preview_headers = {
            "api-key": AZURE_OPENAI_API_KEY,
            "OpenAI-Beta": "realtime=v1",
        }
        ga_url = f"{ws_base}/openai/v1/realtime?model={deployment}"
        ga_headers = {
            "api-key": AZURE_OPENAI_API_KEY,
        }

        # Azure preview and GA endpoints use different URL formats.
        if api_version.endswith("-preview"):
            return (preview_url, preview_headers), (ga_url, ga_headers)
        return (ga_url, ga_headers), (preview_url, preview_headers)

    ws_url = f"wss://api.openai.com/v1/realtime?model={OPENAI_REALTIME_MODEL}"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1",
    }
    return (ws_url, headers), None


@app.api_route("/", methods=["GET", "POST"])
async def index_page():
    return "<h1>Server is up and running </h1>"


@app.api_route("/incoming-call", methods=["GET", "POST"])
async def handle_incoming_call(request: Request):
    """Handle incoming call and return TwiML response to connect to Media Stream."""
    response = VoiceResponse()
    response.say(
        f"Welcome to {HOSPITAL_NAME}. You are connected to our automated hospital assistant."
    )
    response.pause(length=1)
    response.say(
        "Please tell me if you need appointments, lab reports, billing support, or to speak with an operator."
    )
    host = request.url.hostname
    connect = Connect()
    connect.stream(url=f'wss://{host}/media-stream')
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")


@app.websocket("/media-stream")
async def handle_media_stream(websocket: WebSocket):
    """Handle WebSocket connections between Twilio and OpenAI."""
    print("Client connected")
    await websocket.accept()
    primary, fallback = build_realtime_connection()

    async def bridge(ws_url, ws_headers):
        async with websockets.connect(
                ws_url,
                additional_headers=ws_headers) as openai_ws:
            await send_session_update(openai_ws)
            stream_sid = None

            async def receive_from_twilio():
                """Receive audio data from Twilio and send it to the OpenAI Realtime API."""
                nonlocal stream_sid
                try:
                    async for message in websocket.iter_text():
                        data = json.loads(message)
                        if data['event'] == 'media':
                            audio_append = {
                                "type": "input_audio_buffer.append",
                                "audio": data['media']['payload']
                            }
                            try:
                                await openai_ws.send(json.dumps(audio_append))
                            except Exception as e:
                                print(f"Error sending audio to OpenAI realtime: {e}")
                                break
                        elif data['event'] == 'start':
                            stream_sid = data['start']['streamSid']
                            print(f"Incoming stream has started {stream_sid}")
                except WebSocketDisconnect:
                    print("Client disconnected.")
                    try:
                        await openai_ws.close()
                    except Exception:
                        pass

            async def send_to_twilio():
                """Receive events from the OpenAI Realtime API, send audio back to Twilio."""
                nonlocal stream_sid
                try:
                    async for openai_message in openai_ws:
                        response = json.loads(openai_message)
                        if response['type'] in LOG_EVENT_TYPES:
                            print(f"Received event: {response['type']}", response)
                        if response['type'] == 'session.updated':
                            print("Session updated successfully:", response)
                        if response[
                                'type'] == 'response.audio.delta' and response.get(
                                    'delta'):
                            # Audio from OpenAI
                            try:
                                audio_payload = base64.b64encode(
                                    base64.b64decode(
                                        response['delta'])).decode('utf-8')
                                audio_delta = {
                                    "event": "media",
                                    "streamSid": stream_sid,
                                    "media": {
                                        "payload": audio_payload
                                    }
                                }
                                await websocket.send_json(audio_delta)
                            except Exception as e:
                                print(f"Error processing audio data: {e}")
                except Exception as e:
                    print(f"Error in send_to_twilio: {e}")

            await asyncio.gather(receive_from_twilio(), send_to_twilio())

    ws_url, ws_headers = primary
    try:
        await bridge(ws_url, ws_headers)
    except Exception as e:
        print(f"OpenAI realtime websocket connection failed: {e}")
        print(f"Attempted URL: {ws_url}")
        if fallback:
            fallback_url, fallback_headers = fallback
            print(f"Retrying with fallback URL: {fallback_url}")
            try:
                await bridge(fallback_url, fallback_headers)
                return
            except Exception as fallback_error:
                print(f"Fallback websocket connection failed: {fallback_error}")
                print(f"Fallback URL: {fallback_url}")
        print(
            "Check AZURE_OPENAI_DEPLOYMENT is a realtime deployment name "
            "(for example: gpt-4o-realtime-preview, gpt-4o-mini-realtime-preview, or gpt-realtime)."
        )
        await websocket.close()


async def send_session_update(openai_ws):
    """Send session update to OpenAI WebSocket."""
    session_update = {
        "type": "session.update",
        "session": {
            "turn_detection": {
                "type": "server_vad"
            },
            "input_audio_format": "g711_ulaw",
            "output_audio_format": "g711_ulaw",
            "voice": VOICE,
            "instructions": SYSTEM_MESSAGE,
            "modalities": ["text", "audio"],
            "temperature": 0.8,
        }
    }
    print('Sending session update:', json.dumps(session_update))
    await openai_ws.send(json.dumps(session_update))


if __name__ == "__main__":

    uvicorn.run(app, host="0.0.0.0")
