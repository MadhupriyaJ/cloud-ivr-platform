# Metronic (Vite + TS) UI with Python Backend

This implementation is split into two independent folders:

- `typescript/vite/` -> Metronic Tailwind React UI
- `server/` -> FastAPI WebSocket bridge to Azure/OpenAI Realtime

`main.py` is not modified.

## Folder Structure

```text
typescript/
  vite/
    src/pages/ivr/
      IvrStudioPage.tsx
      useRealtimeIvr.ts
      audio.ts
      api.ts
      types.ts
    src/routing/AppRoutingSetup.tsx
    package.json
    vite.config.ts
    index.html

server/
  app/
    main.py
    config.py
    realtime.py
    bridge.py
    prompt.py
    __init__.py
  run.py
```

## Backend Run (Python)

From repository root:

```powershell
python server/run.py
```

Backend URL:

- Health: `http://localhost:8010/health`
- WebSocket: `ws://localhost:8010/ws`

## Frontend Run (Metronic)

Open a second terminal:

```powershell
cd typescript/vite
npm install
npm run dev
```

Frontend URL:

- `http://localhost:5173`
- IVR page: `http://localhost:5173/ivr/studio` (also default `/`)

## Environment Variables

The backend reads `.env` from repository root.

Optional local Metronic UI override:

- Create `typescript/vite/.env.local`
- Add:

```env
VITE_BACKEND_WS_URL=ws://localhost:8010/ws
VITE_BACKEND_HTTP_URL=http://localhost:8010
```

## Developer Notes

- Audio capture/playback is PCM16 on both frontend and backend.
- The frontend filters near-silent chunks before streaming to reduce false model turns.
- The backend keeps IVR responses concise with strict prompt and low temperature.
- If you change audio format, update both frontend (`typescript/vite/src/pages/ivr/audio.ts`) and backend (`server/app/realtime.py`) together.
