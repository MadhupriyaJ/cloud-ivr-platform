# Codebase Analysis Notes

## Current Architecture

### FastAPI Server (server/)
- **main.py**: Creates FastAPI app, domain registry, hospital store, WebSocket bridge
- **domains.py**: DomainConfig dataclass + DomainRegistry (JSON file storage)
- **hospital.py**: HospitalStore with SQLite - doctors, appointments, slots, verification
- **bridge.py**: WebSocket bridge between browser and OpenAI Realtime API
- **realtime.py**: HOSPITAL_TOOLS hardcoded, session initialization
- **intent_guard.py**: Keyword-based intent classification
- **prompt.py**: Builds system prompt from DomainConfig
- **config.py**: Settings dataclass from env vars

### NestJS Backend (backend-nestjs/)
- Domain CRUD with MSSQL
- DomainIntents, DomainRules, PromptTemplates, ToolDefinitions
- RealtimeService with session management
- Conversations persistence
- Hospital module with full business logic

### Key Problems Identified
1. HOSPITAL_TOOLS hardcoded in realtime.py (line 10-75)
2. tool_handler=hospital_store.execute_tool hardcoded in main.py (line 256)
3. IntentGuard uses keyword matching only - no Gen AI
4. No adapter pattern - hospital logic directly wired
5. No dynamic tool loading per domain
6. No integration layer for external APIs

## Enhancement Plan

### Core Changes Needed
1. **Adapter Interface** - Abstract base for domain adapters
2. **Adapter Registry** - Dynamic loading of adapters per domain
3. **Tool Registry** - Load tools from config, not hardcoded
4. **Integration Router** - Route intent → adapter → core system
5. **Config-driven IVR** - JSON/YAML domain configs with tool mappings
6. **Gen AI Intent Classification** - Replace keyword matching with LLM
7. **Fallback + Retry** - Circuit breaker pattern for adapter calls
8. **Queue System** - Async task processing for heavy operations
