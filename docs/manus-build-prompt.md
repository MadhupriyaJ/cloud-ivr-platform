Build a production-ready generic multi-domain realtime IVR platform.

Use:
- frontend: React + TypeScript + Vite
- backend: NestJS
- database: Microsoft SQL Server
- Azure OpenAI Realtime
- Azure AI Speech
- Azure Communication Services

Do not build a hospital-only or banking-only app. Build a reusable platform where admins can create any domain from UI and configure:
- domain details
- intents
- rules
- prompt templates
- allowed tools
- fallback behavior
- escalation policies
- agent handoff behavior

Backend rules:
- runtime behavior must come from MSSQL configuration
- AI must not answer outside allowed intents
- tool execution must be server-controlled
- business-critical outputs must come from database/tool results
- transcript and tool history must be persisted

Required deliverables:
- admin portal
- realtime IVR test console
- agent console
- reporting dashboard
- NestJS backend APIs
- websocket realtime orchestration
- MSSQL migrations
- clean modular folder structure

Follow the architecture in `docs/generic-multidomain-ivr-architecture.md`.
