# Cloud IVR Platform

AI voice IVR: callers talk (phone via Twilio, or browser) to an Azure OpenAI
Realtime model configured per business domain (hospital, banking, …). Calls the
AI cannot handle are escalated to human agents.

| Folder | What |
|---|---|
| `backend-nestjs/` | NestJS API + websockets (the only backend; deployed by `render.yaml`) |
| `typescript/vite/` | React admin UI (Metronic template); `/ivr/*` and `/domains` pages |
| `database/mssql/`, `backend-nestjs/sql/` | SQL Server schema and seed data |
| `docs/` | Architecture, telephony and escalation guides |

## Run locally

```powershell
cd backend-nestjs
copy .env.example .env      # fill in MSSQL_* and AZURE_OPENAI_*
npm install
npm run db:migrate:all      # empty database → full schema + hospital/banking seed
npm run dev                 # backend :8010 + frontend :5173
```

Open `http://localhost:5173`. Health check: `http://localhost:8010/api/health`.

## Azure keys

Only Azure OpenAI is required for the voice IVR:

- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` — from the resource's *Keys and Endpoint* page
- `AZURE_OPENAI_DEPLOYMENT` — your deployment name of `gpt-realtime-mini`

The backend uses the GA Realtime endpoint (`/openai/v1/realtime?model=…`); the
preview `api-version` endpoint was deprecated by Azure on 2026-04-30.
Azure AI Speech keys are optional (browser Speech SDK token and avatar only).

## Phone calls

See [docs/TELEPHONY_AND_ESCALATION.md](docs/TELEPHONY_AND_ESCALATION.md).

## Tests

```powershell
node ivr-conversation-test.mjs    # interactive IVR conversation tester (needs backend running)
```
