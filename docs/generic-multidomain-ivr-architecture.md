# Generic Multi-Domain Realtime IVR Platform

## Objective

Build a production-oriented, configuration-driven IVR platform that can support any domain without rewriting the core platform. Domain behavior must come from configuration stored in MSSQL and enforced by the NestJS backend.

## Core Principles

- The platform is domain-agnostic.
- Domain onboarding happens through admin configuration, not hardcoded modules.
- AI responses are backend-controlled, not model-controlled.
- Business-critical answers must come from approved tools and database results.
- Human agent handoff is part of the runtime flow.

## Technology Stack

- Frontend: React + TypeScript + Vite
- Backend: NestJS + WebSocket gateway + MSSQL integration
- Database: Microsoft SQL Server
- Azure services:
  - Azure OpenAI Realtime
  - Azure AI Speech
  - Azure Communication Services

## Runtime Flow

1. Admin creates or updates a domain in the admin portal.
2. Domain configuration is stored in MSSQL.
3. End user starts a realtime IVR session.
4. Backend creates a conversation and loads domain config, intents, rules, prompts, and tools.
5. Backend builds the runtime prompt.
6. Backend opens Azure OpenAI Realtime session.
7. User audio is streamed into the backend.
8. Backend applies intent guard and policy checks before allowing model response creation.
9. If the model requests a tool, backend validates the tool against the current domain and executes approved business logic.
10. Assistant response is streamed back to the caller.
11. If escalation policy matches, backend assigns an agent and transfers the session through Azure Communication Services.
12. Transcript, tool logs, and conversation state are stored in MSSQL.

## Primary Backend Modules

- `auth`: login, JWT, roles
- `domains`: domain master data
- `domain-intents`: allowed intents per domain
- `domain-rules`: compliance and response restrictions
- `prompt-templates`: runtime prompt fragments
- `tool-definitions`: domain-specific tool metadata
- `realtime`: websocket entrypoint and orchestration
- `conversations`: transcript and session persistence
- `agents`: agent configuration and availability
- `escalations`: escalation lifecycle
- `reports`: operational analytics
- `audit`: admin and runtime audit events

## Dynamic Domain Configuration

These must be data-driven in MSSQL:

- domain metadata
- intent list
- prompt templates
- compliance rules
- fallback responses
- escalation rules
- allowed tools
- field collection requirements

## What This Scaffold Contains

- NestJS backend skeleton for the core modules
- MSSQL initial schema
- build prompt for Manus

## What This Scaffold Does Not Yet Contain

- complete frontend implementation
- real Azure API integration
- agent UI
- production auth flows
- production-grade stored procedures
