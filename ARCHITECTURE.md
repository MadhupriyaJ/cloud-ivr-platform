# Generic IVR Engine - Architecture Documentation

**Author:** Manus AI | **Version:** 1.0 | **Date:** March 27, 2026

---

## 1. Executive Summary

The Generic IVR Engine is a scalable, domain-driven Interactive Voice Response platform designed to dynamically adapt to multiple business domains such as Banking, Hospital, and E-Commerce. The system eliminates hardcoded call flows by using a configuration-driven approach where IVR menus, actions, and routing are defined in a SQL Server database. When a new domain is added, no code changes are required; only database configuration and API endpoint mapping are needed.

The platform consists of three primary layers: the **IVR Flow Engine** (NestJS backend), the **API Integration Layer** (flexible REST adapter), and the **Management Dashboard** (Metronic React frontend). Together, these layers provide a complete solution for building, testing, and operating multi-domain IVR systems.

---

## 2. System Architecture Overview

The architecture follows a layered, domain-driven design where each layer has a clear responsibility and communicates through well-defined interfaces.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MANAGEMENT DASHBOARD                            │
│              (React + Metronic + TypeScript + Vite)                 │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ IVR Flow │ │ Flow     │ │ API      │ │ Flow     │ │ Sessions │ │
│  │ Manager  │ │ Detail   │ │ Endpoints│ │ Simulator│ │ & Logs   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API (HTTP)
┌──────────────────────────────▼──────────────────────────────────────┐
│                     IVR FLOW ENGINE (NestJS)                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Flow Loader  │  │ Flow         │  │ API Integration Service  │  │
│  │ Service      │  │ Executor     │  │ (REST Adapter Layer)     │  │
│  │              │  │ Service      │  │                          │  │
│  │ - Load flows │  │ - Sessions   │  │ - Dynamic HTTP calls     │  │
│  │ - Cache      │  │ - Node walk  │  │ - Request/Response map   │  │
│  │ - Validate   │  │ - Variables  │  │ - Fallback handling      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                │
│  ┌──────▼─────────────────▼────────────────────────▼─────────────┐  │
│  │                  SQL Server Database                           │  │
│  │  Domains │ IvrFlows │ IvrFlowNodes │ IvrNodeActions │ ...     │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                     CORE SYSTEM APIs                                │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Hospital     │  │ Banking      │  │ E-Commerce               │  │
│  │ Core System  │  │ Core System  │  │ Core System              │  │
│  │              │  │              │  │                          │  │
│  │ - Appt Book  │  │ - Balance    │  │ - Order Status           │  │
│  │ - Lab Report │  │ - Transfer   │  │ - Returns                │  │
│  │ - Billing    │  │ - Card Block │  │ - Product Inquiry        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  (Currently using Mock APIs; replace with real endpoints in prod)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

The IVR Engine uses six core tables to store all configuration. The schema uses `UNIQUEIDENTIFIER` primary keys and `NVARCHAR` fields for maximum flexibility.

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **Domains** | Domain registration and settings | DomainId, DomainCode, DisplayName, IndustryType, WelcomeMessage, FallbackMessage |
| **IvrFlows** | IVR flow definitions per domain | FlowId, DomainId, FlowCode, FlowName, IsEntryFlow, FlowVersion |
| **IvrFlowNodes** | Individual nodes within a flow | NodeId, FlowId, NodeCode, NodeType, PromptText, NextNodeCode, BranchConfig |
| **IvrNodeActions** | API actions attached to action nodes | ActionId, NodeId, EndpointId, RequestMapping, ResponseMapping, FallbackResponse |
| **DomainApiEndpoints** | REST API endpoint configurations | EndpointId, DomainId, EndpointCode, HttpMethod, BaseUrl, AuthType, TimeoutMs |
| **ErrorLogs** | Error tracking and monitoring | ErrorId, DomainId, SessionId, ErrorType, ErrorMessage, OccurredAt |

### 3.1 Node Types

The flow engine supports five node types, each with distinct behavior during execution:

| Node Type | Behavior | Example |
|-----------|----------|---------|
| `prompt` | Speaks a message and advances to NextNodeCode | Welcome greeting, informational messages |
| `branch` | Routes to different nodes based on user intent (BranchConfig JSON) | Main menu with options |
| `collect_input` | Collects user input and stores it in a session variable | "Please provide your order ID" |
| `action` | Executes an API call via IvrNodeActions, then advances | Check balance, book appointment |
| `end` | Terminates the session with a farewell message | "Thank you for calling" |

### 3.2 Branch Configuration

Branch nodes use a JSON configuration stored in `BranchConfig` that maps user intents to target node codes:

```json
{
  "order_status": "collect_order_id",
  "return": "collect_return_order",
  "product": "collect_product_name",
  "cancel": "collect_cancel_order",
  "reschedule": "collect_reschedule_order"
}
```

### 3.3 Request/Response Mapping

Action nodes use template-based mapping to pass session variables to API requests and extract responses:

```json
// RequestMapping
{ "orderId": "{{orderId}}", "reason": "{{reason}}" }

// ResponseMapping
{ "confirmation": "{{data.message}}" }
```

The double-brace syntax `{{variableName}}` references session variables collected during the flow. The response mapping extracts fields from the API response and stores them back into session variables.

---

## 4. Flow Execution Engine

### 4.1 Session Lifecycle

The flow executor manages in-memory sessions with the following lifecycle:

1. **Start Session** - Client sends `POST /api/ivr-engine/session/start` with `domainCode`. The engine loads the entry flow from the database, creates a session object, and executes the first node.

2. **Process Input** - Client sends `POST /api/ivr-engine/session/:sessionId/input` with `userInput`. The engine processes the input based on the current node type (branch routing, input collection, etc.) and advances the flow.

3. **API Execution** - When an `action` node is reached, the engine looks up the associated `IvrNodeAction`, resolves the API endpoint from `DomainApiEndpoints`, maps session variables into the request body, calls the external API, and maps the response back into session variables.

4. **End Session** - The flow reaches an `end` node or the client sends `POST /api/ivr-engine/session/:sessionId/end`.

### 4.2 Error Handling and Fallbacks

The API Integration Service implements a robust error handling strategy:

- **Timeout Protection**: Each API endpoint has a configurable `TimeoutMs` (default 30,000ms). If the external API does not respond within this window, the call is aborted.

- **Retry Logic**: Each endpoint has a configurable `RetryCount` (default 2). Failed API calls are retried with exponential backoff before falling back.

- **Fallback Responses**: Every `IvrNodeAction` has a `FallbackResponse` JSON field. If the API call fails after all retries, the fallback message is spoken to the caller instead.

- **Error Logging**: All failures are logged to the `ErrorLogs` table with the error type, message, stack trace, associated domain, session, and endpoint for debugging.

---

## 5. API Integration Layer

The API Integration Layer is the bridge between the IVR Engine and external core systems. It is designed to be completely generic, meaning it does not contain any domain-specific logic.

### 5.1 How It Works

When the flow executor encounters an `action` node:

1. It queries `IvrNodeActions` to find the action configuration for that node.
2. It resolves the `EndpointId` to get the full API configuration from `DomainApiEndpoints`.
3. It applies `RequestMapping` to substitute session variables into the request body.
4. It makes the HTTP call using the configured method, URL, headers, and authentication.
5. It applies `ResponseMapping` to extract data from the API response into session variables.
6. If the call fails, it uses the `FallbackResponse` instead.

### 5.2 Authentication Support

The `DomainApiEndpoints` table supports four authentication types:

| Auth Type | Description |
|-----------|-------------|
| `none` | No authentication (used for mock APIs) |
| `api_key` | API key sent in headers (configured in AuthConfig JSON) |
| `bearer` | Bearer token authentication |
| `basic` | HTTP Basic authentication (username:password in AuthConfig) |

---

## 6. Frontend Management Dashboard

The Metronic React dashboard provides five management pages for the IVR Engine:

| Page | Route | Purpose |
|------|-------|---------|
| **IVR Flows** | `/ivr/flows` | List, create, edit, and manage IVR flows across all domains |
| **Flow Detail** | `/ivr/flows/:flowId` | View and edit individual flow nodes with a visual flow diagram |
| **API Endpoints** | `/ivr/api-endpoints` | Configure REST API integrations for each domain |
| **Flow Simulator** | `/ivr/simulator` | Interactive IVR call testing with a chat-like interface |
| **Sessions & Logs** | `/ivr/sessions` | Monitor active sessions, view error logs, and track engine health |

All pages communicate with the NestJS backend via REST API calls to `http://localhost:8010/api/ivr-engine/*` and `http://localhost:8010/api/mock/*`.

---

## 7. Domain Configuration Guide

### 7.1 Currently Configured Domains

| Domain | Code | Flows | Nodes | API Endpoints | Mock APIs |
|--------|------|-------|-------|---------------|-----------|
| **Hospital** | `hospital` | 1 (hospital-main) | ~12 | 5 | book-appointment, check-lab-reports, billing-inquiry, departments, doctor-availability |
| **Banking** | `banking` | 1 (banking-main) | ~12 | 5 | check-balance, recent-transactions, fund-transfer, card-block, loan-status |
| **E-Commerce** | `ecommerce` | 1 (ecommerce-main) | 15 | 5 | order-status, return-request, product-inquiry, cancel-order, delivery-reschedule |

### 7.2 How to Add a New Domain

Adding a new domain requires **zero code changes**. Follow these steps:

**Step 1: Insert the Domain**

```sql
INSERT INTO Domains (DomainId, DomainCode, DisplayName, OrganizationName, IndustryType, 
  DefaultLanguage, DefaultVoice, WelcomeMessage, FallbackMessage, EscalationMessage, 
  IsActive, CreatedAt, UpdatedAt)
VALUES (NEWID(), 'insurance', 'Insurance Support', 'SafeGuard Insurance', 'Insurance', 
  'en', 'alloy', 
  'Welcome to SafeGuard Insurance. How can I help you?',
  'Sorry, I did not understand. Please try again.',
  'Let me connect you to an agent.',
  1, GETDATE(), GETDATE());
```

**Step 2: Create the IVR Flow**

```sql
DECLARE @domainId UNIQUEIDENTIFIER = (SELECT DomainId FROM Domains WHERE DomainCode = 'insurance');
INSERT INTO IvrFlows (FlowId, DomainId, FlowCode, FlowName, Description, IsEntryFlow, FlowVersion, IsActive, CreatedAt, UpdatedAt)
VALUES (NEWID(), @domainId, 'insurance-main', 'Insurance Customer Support', 'Main IVR flow for insurance', 1, 1, 1, GETDATE(), GETDATE());
```

**Step 3: Add Flow Nodes**

Create nodes for each step in the IVR flow. Use the five node types (`prompt`, `branch`, `collect_input`, `action`, `end`) to define the call flow:

```sql
DECLARE @flowId UNIQUEIDENTIFIER = (SELECT FlowId FROM IvrFlows WHERE FlowCode = 'insurance-main');
-- Welcome node
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, NextNodeCode, TimeoutSeconds, MaxRetries, IsActive, CreatedAt)
VALUES (NEWID(), @flowId, 'welcome', 'prompt', 'Welcome', 'Welcome to SafeGuard Insurance!', 10, 'main_menu', 30, 3, 1, GETDATE());
-- Branch node
INSERT INTO IvrFlowNodes (NodeId, FlowId, NodeCode, NodeType, NodeLabel, PromptText, SortOrder, BranchConfig, TimeoutSeconds, MaxRetries, IsActive, CreatedAt)
VALUES (NEWID(), @flowId, 'main_menu', 'branch', 'Main Menu', 'Say: Claim Status, New Claim, or Policy Info', 20, 
  '{"claim_status":"collect_claim_id","new_claim":"collect_claim_type","policy":"collect_policy_id"}', 30, 3, 1, GETDATE());
-- ... add more nodes as needed
```

**Step 4: Configure API Endpoints**

Map each external API that the domain needs to call:

```sql
DECLARE @domainId UNIQUEIDENTIFIER = (SELECT DomainId FROM Domains WHERE DomainCode = 'insurance');
INSERT INTO DomainApiEndpoints (EndpointId, DomainId, EndpointCode, EndpointName, HttpMethod, BaseUrl, Path, AuthType, TimeoutMs, RetryCount, IsActive, CreatedAt, UpdatedAt)
VALUES (NEWID(), @domainId, 'ins_claim_status', 'Claim Status Check', 'POST', 'https://api.safeguard.com/claims/status', '', 'bearer', 30000, 2, 1, GETDATE(), GETDATE());
```

**Step 5: Link Actions to Endpoints**

Connect action nodes to their API endpoints with request/response mapping:

```sql
DECLARE @nodeId UNIQUEIDENTIFIER = (SELECT NodeId FROM IvrFlowNodes WHERE NodeCode = 'check_claim_status' AND FlowId = (SELECT FlowId FROM IvrFlows WHERE FlowCode = 'insurance-main'));
DECLARE @epId UNIQUEIDENTIFIER = (SELECT EndpointId FROM DomainApiEndpoints WHERE EndpointCode = 'ins_claim_status');
INSERT INTO IvrNodeActions (ActionId, NodeId, ActionType, ActionOrder, ToolName, EndpointId, RequestMapping, ResponseMapping, FallbackResponse, IsActive, CreatedAt)
VALUES (NEWID(), @nodeId, 'api_call', 1, 'ins_claim_status', @epId, 
  '{"claimId":"{{claimId}}"}', 
  '{"confirmation":"{{data.message}}"}', 
  '{"message":"Claim service is temporarily unavailable."}', 
  1, GETDATE());
```

**Step 6: Test the Domain**

Use the Flow Simulator in the dashboard or call the API directly:

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/start \
  -H "Content-Type: application/json" \
  -d '{"domainCode":"insurance"}'
```

**Step 7 (Optional): Add Mock APIs**

If the real core system is not available, add mock endpoints to `mock-api.controller.ts` for testing. This is the only step that requires a code change, and it is optional.

---

## 8. Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| IVR Engine Backend | NestJS + TypeScript + TypeORM | Flow execution, API integration, session management |
| Database | Microsoft SQL Server | Domain config, flow definitions, error logs |
| Frontend Dashboard | React + TypeScript + Metronic + Vite | Management UI, flow visualization, simulator |
| Mock APIs | NestJS Controllers | Simulated core system responses for demo/testing |
| Manus Webdev Proxy | Express + tRPC + React | Deployed preview dashboard with auth |

---

## 9. API Reference

### 9.1 Flow Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ivr-engine/session/start` | Start a new IVR session. Body: `{ "domainCode": "hospital" }` |
| POST | `/api/ivr-engine/session/:sessionId/input` | Send user input. Body: `{ "userInput": "appointment" }` |
| GET | `/api/ivr-engine/session/:sessionId` | Get session state (variables, history, current node) |
| POST | `/api/ivr-engine/session/:sessionId/end` | End a session |

### 9.2 Flow Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ivr-engine/flows` | List all IVR flows (optional `?domainCode=hospital`) |
| POST | `/api/ivr-engine/flows` | Create a new flow |
| PUT | `/api/ivr-engine/flows/:flowId` | Update a flow |
| GET | `/api/ivr-engine/flows/:flowId/nodes` | Get all nodes for a flow |
| POST | `/api/ivr-engine/flows/:flowId/nodes` | Create a node in a flow |
| PUT | `/api/ivr-engine/nodes/:nodeId` | Update a node |
| DELETE | `/api/ivr-engine/nodes/:nodeId` | Delete a node |

### 9.3 API Endpoint Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ivr-engine/endpoints` | List all API endpoints (optional `?domainCode=hospital`) |
| POST | `/api/ivr-engine/endpoints` | Create a new endpoint |
| PUT | `/api/ivr-engine/endpoints/:endpointId` | Update an endpoint |

### 9.4 Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ivr-engine/health` | Engine health status (flows, nodes, endpoints, errors) |
| GET | `/api/ivr-engine/sessions/active` | List all active sessions |
| GET | `/api/ivr-engine/errors` | Get error logs (optional `?domainCode=hospital&limit=50`) |

---

## 10. Deployment and Running

### 10.1 Prerequisites

- Node.js 18+ (LTS recommended)
- Microsoft SQL Server (local or remote)
- npm or pnpm package manager

### 10.2 Backend Setup

```bash
cd backend-nestjs
cp .env.example .env   # Edit with your DB credentials
npm install
npm run build
npm run start:prod      # or: PORT=8010 node dist/main.js
```

### 10.3 Frontend Setup

```bash
cd typescript/vite
pnpm install
pnpm dev                # Starts on http://localhost:5173
```

### 10.4 Seed Data

The repository includes seed scripts for each domain:

```bash
cd backend-nestjs
node seed-ecommerce-domain.mjs    # Seeds e-commerce domain
# Hospital and Banking domains are seeded via DDL/DML scripts
```

### 10.5 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` / `MSSQL_HOST` | SQL Server hostname | `203.101.44.46` |
| `DB_PORT` / `MSSQL_PORT` | SQL Server port | `1433` |
| `DB_NAME` / `MSSQL_DATABASE` | Database name | `ivr_platform` |
| `DB_USER` / `MSSQL_USERNAME` | Database username | `sa` |
| `DB_PASSWORD` / `MSSQL_PASSWORD` | Database password | `***` |
| `PORT` | Backend server port | `8010` |

---

## 11. Extensibility Principles

The system is designed around three extensibility principles:

1. **Configuration over Code**: New domains are added entirely through database configuration. The IVR engine reads flow definitions, node configurations, and API mappings from the database at runtime.

2. **Generic API Adapter**: The API Integration Service does not contain any domain-specific logic. It reads endpoint configurations from `DomainApiEndpoints` and uses template-based request/response mapping to communicate with any REST API.

3. **Pluggable Node Types**: The flow executor uses a strategy pattern for node types. Adding a new node type (e.g., `transfer_call`, `play_audio`) requires adding a handler in the flow executor service, but all existing domains continue to work without changes.

---

## 12. File Structure

```
cloud-ivr-platform/
├── backend-nestjs/                    # NestJS IVR Engine Backend
│   ├── src/
│   │   ├── modules/
│   │   │   └── ivr-engine/
│   │   │       ├── ivr-engine.controller.ts    # REST API endpoints
│   │   │       ├── ivr-engine.module.ts        # NestJS module
│   │   │       ├── ivr-flow-loader.service.ts  # Flow loading from DB
│   │   │       ├── flow-executor.service.ts    # Session & flow execution
│   │   │       ├── api-integration.service.ts  # Generic API adapter
│   │   │       └── mock-api.controller.ts      # Mock core system APIs
│   │   └── app.module.ts
│   ├── sql/
│   │   ├── ddl/                        # Table creation scripts
│   │   └── dml/                        # Seed data scripts
│   ├── seed-ecommerce-domain.mjs       # E-commerce domain seeder
│   └── .env                            # Environment configuration
├── typescript/vite/                    # Metronic React Dashboard
│   └── src/
│       └── pages/ivr/
│           ├── IvrFlowsPage.tsx        # Flow management
│           ├── IvrFlowDetailPage.tsx   # Flow node editor
│           ├── ApiEndpointsPage.tsx     # API endpoint config
│           ├── IvrSimulatorPage.tsx     # Interactive flow tester
│           ├── IvrSessionsPage.tsx     # Session monitoring
│           └── ivr-engine-api.ts       # API client functions
├── ivr-dashboard/                      # Manus Webdev Proxy Dashboard
└── ARCHITECTURE.md                     # This document
```
