# Domain-Connected Intelligent IVR Architecture

## Overview

The Cloud IVR Platform has been enhanced from a generic, hardcoded system into a scalable, **Domain-Connected Intelligent IVR Platform**. This architecture enables the platform to serve multiple tenants across various industries (Healthcare, Banking, Insurance, Logistics, etc.) from a single unified codebase.

The core of this enhancement is the **Adapter Framework**, which acts as a bridge between the Gen AI Realtime API and domain-specific core systems (like Hospital Management Systems or Core Banking Systems).

## Key Enhancements

### 1. Plug-and-Play Domain Adapters
Instead of hardcoding domain logic (like `hospital.py`), the system now uses a dynamic `AdapterRegistry`. Adapters translate the AI's generic intent into system-specific API calls.

*   **HospitalAdapter**: Connects to HMS for patient verification, slot availability, and appointment booking.
*   **BankingAdapter**: Connects to CBS for balance inquiry, card blocking, and mini-statements.
*   **InsuranceAdapter**: Connects to Policy systems for claim status and premium info.
*   **LogisticsAdapter**: Connects to Shipping systems for tracking and pickup scheduling.
*   **GenericAdapter**: A flexible fallback that uses Webhooks to forward requests to any custom system.

### 2. Configuration-Driven IVR
The platform is now fully configuration-driven. Domain behavior, available tools, and connection settings are defined in JSON/YAML configuration files or the database, rather than in code.

```json
{
  "domain_id": "hospital",
  "adapter_type": "hospital",
  "api_base_url": "https://api.hospital.com",
  "intents": {
    "book_appointment": {
      "adapter": "hospital",
      "action": "book_appointment"
    }
  }
}
```

### 3. AI-Powered Intent Guard
The keyword-based `IntentGuard` has been replaced with `AIIntentGuard`. It uses a lightweight Gen AI model (`gpt-4.1-nano`) to accurately classify caller utterances against the domain's allowed intents, providing much higher accuracy and handling complex phrasing. It gracefully falls back to keyword matching if the AI is unavailable.

### 4. Integration Router with Circuit Breaker
The `IntegrationRouter` sits between the WebSocket bridge and the adapters. It provides:
*   **Dynamic Tool Resolution**: Loads the correct tools for the specific domain at session start.
*   **Retry Logic**: Automatically retries failed API calls to backend systems.
*   **Circuit Breaker**: Prevents overwhelming backend systems if they go down.
*   **Audit Logging**: Records all tool executions for monitoring.

### 5. Multi-Channel Escalation Manager
When the AI cannot resolve an issue, the `EscalationManager` takes over. It supports routing calls via:
*   **SIP Transfer**: Traditional PBX handoff.
*   **Queue**: Contact center queuing.
*   **Callback**: Scheduling a return call.
*   **Webhook**: Notifying external ticketing systems.

## Architecture Flow

1.  **Caller connects** via browser/phone to the WebSocket (`/ws?domain=banking`).
2.  **Domain Config Loader** resolves the domain and its associated `AdapterConfig`.
3.  **Integration Router** fetches the required tools from the appropriate `DomainAdapter` (e.g., `BankingAdapter`).
4.  **Realtime Session** is initialized with the domain's specific system prompt and tools.
5.  **Caller speaks**. The audio is transcribed.
6.  **AIIntentGuard** verifies the intent is within scope.
7.  **AI triggers a tool call** (e.g., `get_account_balance`).
8.  **Integration Router** executes the tool via the `BankingAdapter`.
9.  **Adapter calls the Core System API** (with retries/circuit breaking).
10. **Result is returned** to the AI, which synthesizes a voice response for the caller.

## Benefits

*   **Zero-Code Onboarding**: New tenants can be added purely through configuration.
*   **High Cohesion, Loose Coupling**: The IVR engine knows nothing about banking or healthcare; it only knows about adapters.
*   **Resilience**: Built-in retries and circuit breakers protect both the IVR and the backend systems.
*   **Scalability**: The generic architecture allows massive horizontal scaling across diverse industries.
