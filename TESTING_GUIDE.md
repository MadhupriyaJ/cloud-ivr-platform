# IVR Platform Testing Guide

**Author:** Manus AI
**Date:** March 27, 2026

---

## 1. Overview

This guide covers every way to test the Generic IVR Platform, from quick health checks to full end-to-end session flows. All examples use **curl** commands (Windows-compatible with PowerShell alternatives) and include real responses captured from the running system. The platform exposes its API on **port 8010** with a global prefix of `/api`.

The testing layers are organized as follows:

| Layer | What It Tests | Tool |
|---|---|---|
| Health & Discovery | Backend alive, engine stats | curl / browser |
| Mock APIs | Simulated core systems (Hospital, Banking, E-Commerce) | curl / Postman |
| IVR Session Flows | Full call lifecycle: start → input → state → end | curl / Postman |
| Flow Management CRUD | Create, read, update flows, nodes, actions, endpoints | curl / Postman |
| Error Handling | Invalid domains, missing fields, nonexistent sessions | curl / Postman |
| Automated Tests | 47 vitest integration tests | `pnpm test` |
| Frontend Simulator | Interactive browser-based IVR testing | Browser UI |

---

## 2. Prerequisites

Before running any tests, ensure the NestJS backend is running. Open a terminal (Command Prompt or PowerShell on Windows) and start the server:

```bash
cd backend-nestjs
npm install
set PORT=8010 && node dist/main.js
```

Verify the server is alive:

```bash
curl http://localhost:8010/api/health
```

**Expected response:**

```json
{
    "status": "ok",
    "service": "generic-ivr-platform-backend"
}
```

---

## 3. Health & Discovery Endpoints

### 3.1 Backend Health Check

This confirms the NestJS server and database connection are working.

```bash
curl http://localhost:8010/api/health
```

### 3.2 IVR Engine Health

This returns live statistics about the IVR engine including flow counts, node counts, active sessions, and recent errors.

```bash
curl http://localhost:8010/api/ivr-engine/health
```

**Expected response:**

```json
{
    "status": "healthy",
    "engine": {
        "flows": 3,
        "nodes": 45,
        "endpoints": 15,
        "activeSessions": 0,
        "errorsLast24h": 0
    },
    "timestamp": "2026-03-27T08:39:27.533Z"
}
```

The `engine` object tells you that 3 IVR flows are configured (Hospital, Banking, E-Commerce), with 45 total nodes and 15 API endpoint mappings across all domains.

---

## 4. Mock API Testing

Mock APIs simulate the real core systems. In production, these would be replaced by actual hospital/banking/e-commerce backend URLs. Each mock endpoint follows the pattern `POST /api/mock/{domain}/{action}`.

### 4.1 Hospital Mock APIs

**Book an Appointment:**

```bash
curl -X POST http://localhost:8010/api/mock/hospital/book-appointment ^
  -H "Content-Type: application/json" ^
  -d "{\"department\":\"Cardiology\",\"date\":\"2026-04-01\",\"patientName\":\"Madhu\"}"
```

**Expected response:**

```json
{
    "success": true,
    "data": {
        "appointmentId": "APT-MN8J2KNP",
        "department": "Cardiology",
        "date": "2026-04-01",
        "patientName": "Madhu",
        "doctorName": "Dr. Sharma",
        "timeSlot": "10:30 AM",
        "status": "confirmed",
        "confirmationMessage": "Your appointment APT-MN8J2KNP with Dr. Sharma in Cardiology is confirmed for 2026-04-01."
    }
}
```

**Check Lab Reports:**

```bash
curl -X POST http://localhost:8010/api/mock/hospital/check-lab-reports ^
  -H "Content-Type: application/json" ^
  -d "{\"patientId\":\"PAT-001\"}"
```

**Billing Inquiry:**

```bash
curl -X POST http://localhost:8010/api/mock/hospital/billing-inquiry ^
  -H "Content-Type: application/json" ^
  -d "{\"patientId\":\"PAT-001\"}"
```

**List Departments (GET):**

```bash
curl http://localhost:8010/api/mock/hospital/departments
```

**Doctor Availability (GET):**

```bash
curl "http://localhost:8010/api/mock/hospital/doctor-availability?department=Cardiology"
```

### 4.2 Banking Mock APIs

**Check Balance:**

```bash
curl -X POST http://localhost:8010/api/mock/banking/check-balance ^
  -H "Content-Type: application/json" ^
  -d "{\"accountNumber\":\"1234567890\"}"
```

**Expected response:**

```json
{
    "success": true,
    "data": {
        "accountNumber": "****7890",
        "accountType": "Savings",
        "balance": 45750.5,
        "currency": "INR",
        "lastTransaction": {
            "type": "credit",
            "amount": 25000,
            "date": "2026-03-26",
            "description": "Salary Credit"
        },
        "message": "Your savings account ending 7890 has a balance of ₹45,750.50."
    }
}
```

**Recent Transactions:**

```bash
curl -X POST http://localhost:8010/api/mock/banking/recent-transactions ^
  -H "Content-Type: application/json" ^
  -d "{\"accountNumber\":\"1234567890\"}"
```

**Fund Transfer:**

```bash
curl -X POST http://localhost:8010/api/mock/banking/fund-transfer ^
  -H "Content-Type: application/json" ^
  -d "{\"amount\":5000,\"beneficiary\":\"John Doe\",\"toAccount\":\"9876543210\"}"
```

**Block Card:**

```bash
curl -X POST http://localhost:8010/api/mock/banking/card-block ^
  -H "Content-Type: application/json" ^
  -d "{\"cardNumber\":\"4111111111119876\",\"cardType\":\"Debit\"}"
```

**Loan Status:**

```bash
curl -X POST http://localhost:8010/api/mock/banking/loan-status ^
  -H "Content-Type: application/json" ^
  -d "{\"loanId\":\"LN-2024-001\"}"
```

### 4.3 E-Commerce Mock APIs

**Order Status:**

```bash
curl -X POST http://localhost:8010/api/mock/ecommerce/order-status ^
  -H "Content-Type: application/json" ^
  -d "{\"orderId\":\"ORD-2026-001\"}"
```

**Expected response:**

```json
{
    "success": true,
    "data": {
        "orderId": "ORD-2026-001",
        "status": "shipped",
        "items": [
            { "name": "Wireless Headphones", "qty": 1, "price": 2999 },
            { "name": "Phone Case", "qty": 2, "price": 499 }
        ],
        "trackingId": "TRACK-XYZ-123",
        "estimatedDelivery": "2026-03-29",
        "message": "Your order ORD-2026-001 has been shipped. Tracking: TRACK-XYZ-123. Expected delivery: March 29, 2026."
    }
}
```

**Return Request:**

```bash
curl -X POST http://localhost:8010/api/mock/ecommerce/return-request ^
  -H "Content-Type: application/json" ^
  -d "{\"orderId\":\"ORD-2026-001\",\"reason\":\"Wrong size\"}"
```

**Product Inquiry:**

```bash
curl -X POST http://localhost:8010/api/mock/ecommerce/product-inquiry ^
  -H "Content-Type: application/json" ^
  -d "{\"productName\":\"laptop\"}"
```

**Cancel Order:**

```bash
curl -X POST http://localhost:8010/api/mock/ecommerce/cancel-order ^
  -H "Content-Type: application/json" ^
  -d "{\"orderId\":\"ORD-2026-001\"}"
```

**Reschedule Delivery:**

```bash
curl -X POST http://localhost:8010/api/mock/ecommerce/delivery-reschedule ^
  -H "Content-Type: application/json" ^
  -d "{\"orderId\":\"ORD-2026-001\",\"preferredDate\":\"2026-04-05\",\"timeSlot\":\"2:00 PM - 6:00 PM\"}"
```

The complete list of all 15+ mock endpoints is summarized below:

| Domain | Endpoint | Method | Description |
|---|---|---|---|
| Hospital | `/api/mock/hospital/book-appointment` | POST | Book a doctor appointment |
| Hospital | `/api/mock/hospital/check-lab-reports` | POST | Retrieve lab report results |
| Hospital | `/api/mock/hospital/billing-inquiry` | POST | Check outstanding bills |
| Hospital | `/api/mock/hospital/departments` | GET | List all departments |
| Hospital | `/api/mock/hospital/doctor-availability` | GET | Check doctor time slots |
| Banking | `/api/mock/banking/check-balance` | POST | Check account balance |
| Banking | `/api/mock/banking/recent-transactions` | POST | Get last 5 transactions |
| Banking | `/api/mock/banking/fund-transfer` | POST | Transfer funds |
| Banking | `/api/mock/banking/card-block` | POST | Block a debit/credit card |
| Banking | `/api/mock/banking/loan-status` | POST | Check loan details |
| E-Commerce | `/api/mock/ecommerce/order-status` | POST | Track order status |
| E-Commerce | `/api/mock/ecommerce/return-request` | POST | Initiate a return |
| E-Commerce | `/api/mock/ecommerce/product-inquiry` | POST | Search product info |
| E-Commerce | `/api/mock/ecommerce/cancel-order` | POST | Cancel an order |
| E-Commerce | `/api/mock/ecommerce/delivery-reschedule` | POST | Reschedule delivery |

---

## 5. End-to-End IVR Session Flows

This is the most important section. It demonstrates how a real IVR call flows through the engine, step by step. Each session follows the lifecycle: **Start → Input → Input → ... → End**.

### 5.1 Hospital Domain: Book an Appointment

This example walks through a complete hospital IVR call where the caller books a Cardiology appointment.

**Step 1: Start the session**

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/start ^
  -H "Content-Type: application/json" ^
  -d "{\"domainCode\":\"hospital-management\"}"
```

**Response:** The engine loads the hospital flow and returns the welcome prompt.

```json
{
    "sessionId": "sess_1774600779968_313r8g",
    "step": {
        "nodeCode": "welcome",
        "nodeType": "prompt",
        "promptText": "Welcome to City Care Hospital. How can I help you today? You can say: Book an appointment, Check lab reports, Billing inquiry, or speak to an agent.",
        "action": "speak",
        "nextNodeCode": "route_intent"
    },
    "status": "active"
}
```

> Save the `sessionId` from the response. You will need it for all subsequent calls.

**Step 2: User says "appointment"** (intent routing)

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/sess_1774600779968_313r8g/input ^
  -H "Content-Type: application/json" ^
  -d "{\"userInput\":\"appointment\"}"
```

**Response:** The engine routes to the `collect_department` node.

```json
{
    "sessionId": "sess_1774600779968_313r8g",
    "step": {
        "nodeCode": "collect_department",
        "nodeType": "collect_input",
        "promptText": "Which department would you like to visit? We have Cardiology, Orthopedics, General Medicine, and Pediatrics.",
        "action": "collect",
        "data": { "collectField": "department" }
    },
    "status": "active",
    "variables": {
        "_lastBranchIntent": "appointment"
    }
}
```

**Step 3: User says "Cardiology"** (collect department)

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/sess_1774600779968_313r8g/input ^
  -H "Content-Type: application/json" ^
  -d "{\"userInput\":\"Cardiology\"}"
```

**Response:** Department stored, engine moves to collect date.

```json
{
    "variables": {
        "_lastBranchIntent": "appointment",
        "department": "Cardiology"
    }
}
```

**Step 4: User says "2026-04-01"** (collect date)

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/sess_1774600779968_313r8g/input ^
  -H "Content-Type: application/json" ^
  -d "{\"userInput\":\"2026-04-01\"}"
```

**Response:** Date stored, engine advances to the API action node which calls the mock hospital booking API.

**Step 5: Check session state** (optional, for debugging)

```bash
curl http://localhost:8010/api/ivr-engine/session/sess_1774600779968_313r8g
```

**Response:** Full session state including all collected variables and history.

```json
{
    "sessionId": "sess_1774600779968_313r8g",
    "domainCode": "hospital-management",
    "currentNode": "book_appointment_api",
    "status": "active",
    "variables": {
        "department": "Cardiology",
        "date": "2026-04-01"
    },
    "history": [ "... array of all steps traversed ..." ],
    "startedAt": 1774600780382,
    "durationMs": 214
}
```

**Step 6: End the session**

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/sess_1774600779968_313r8g/end ^
  -H "Content-Type: application/json"
```

**Response:**

```json
{
    "sessionId": "sess_1774600779968_313r8g",
    "status": "completed"
}
```

### 5.2 E-Commerce Domain: Check Order Status

**Step 1: Start session**

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/start ^
  -H "Content-Type: application/json" ^
  -d "{\"domainCode\":\"ecommerce\"}"
```

**Response:**

```json
{
    "sessionId": "sess_1774600793440_62yaxn",
    "step": {
        "nodeCode": "welcome",
        "nodeType": "prompt",
        "promptText": "Welcome to ShopEasy customer support! How can I help you today? You can say: Order Status, Return or Exchange, Product Inquiry, Cancel Order, or Reschedule Delivery.",
        "action": "speak"
    },
    "status": "active"
}
```

**Step 2: User says "order_status"**

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/sess_1774600793440_62yaxn/input ^
  -H "Content-Type: application/json" ^
  -d "{\"userInput\":\"order_status\"}"
```

**Response:** Routes to `collect_order_id` node.

```json
{
    "step": {
        "nodeCode": "collect_order_id",
        "nodeType": "collect_input",
        "promptText": "Please provide your order ID. It starts with ORD followed by numbers.",
        "data": { "collectField": "order_id" }
    },
    "variables": { "_lastBranchIntent": "order_status" }
}
```

**Step 3: User provides order ID**

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/sess_1774600793440_62yaxn/input ^
  -H "Content-Type: application/json" ^
  -d "{\"userInput\":\"ORD-2026-001\"}"
```

**Response:** Order ID stored, engine advances to the API action node.

```json
{
    "variables": {
        "_lastBranchIntent": "order_status",
        "order_id": "ORD-2026-001"
    }
}
```

### 5.3 Banking Domain: Check Balance

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/start ^
  -H "Content-Type: application/json" ^
  -d "{\"domainCode\":\"banking\"}"
```

Then follow the same pattern: provide input matching the branch keywords (e.g., `"balance"`, `"transfer"`, `"card_block"`, `"loan"`), then provide the required data fields when prompted.

### 5.4 Available Domain Codes

| Domain Code | Display Name | Flow Nodes | Description |
|---|---|---|---|
| `hospital-management` | Hospital IVR | 15 nodes | Appointment booking, lab reports, billing |
| `banking` | Banking IVR | 15 nodes | Balance check, transfers, card block, loans |
| `ecommerce` | E-Commerce Support | 15 nodes | Order status, returns, product inquiry, cancellation |

---

## 6. Flow Management CRUD Testing

These endpoints let you manage IVR flows, nodes, and API endpoint configurations without code changes.

### 6.1 List All Flows

```bash
curl http://localhost:8010/api/ivr-engine/flows
```

### 6.2 Filter Flows by Domain

```bash
curl "http://localhost:8010/api/ivr-engine/flows?domainCode=ecommerce"
```

### 6.3 Get Flow Detail with Nodes

First, get the flow ID from the list above, then:

```bash
curl http://localhost:8010/api/ivr-engine/flows/91DC9BD9-8FB5-4F6A-9121-1EC53DE917B2
```

This returns the flow metadata plus all nodes with their actions, giving you the complete flow graph.

### 6.4 Create a New Flow

```bash
curl -X POST http://localhost:8010/api/ivr-engine/flows ^
  -H "Content-Type: application/json" ^
  -d "{\"domainCode\":\"hospital-management\",\"flowCode\":\"feedback_flow\",\"flowName\":\"Patient Feedback\",\"description\":\"Collect patient feedback after visit\",\"isEntryFlow\":false}"
```

### 6.5 Update a Flow

```bash
curl -X PUT http://localhost:8010/api/ivr-engine/flows/{flowId} ^
  -H "Content-Type: application/json" ^
  -d "{\"flowName\":\"Updated Flow Name\",\"description\":\"Updated description\"}"
```

### 6.6 Add a Node to a Flow

```bash
curl -X POST http://localhost:8010/api/ivr-engine/flows/{flowId}/nodes ^
  -H "Content-Type: application/json" ^
  -d "{\"nodeCode\":\"ask_rating\",\"nodeType\":\"collect_input\",\"nodeLabel\":\"Ask Rating\",\"promptText\":\"On a scale of 1 to 5, how would you rate your experience?\",\"sortOrder\":1,\"nextNodeCode\":\"thank_you\"}"
```

### 6.7 List API Endpoints

```bash
curl http://localhost:8010/api/ivr-engine/endpoints
curl "http://localhost:8010/api/ivr-engine/endpoints?domainCode=ecommerce"
```

### 6.8 Create an API Endpoint

```bash
curl -X POST http://localhost:8010/api/ivr-engine/endpoints ^
  -H "Content-Type: application/json" ^
  -d "{\"domainCode\":\"hospital-management\",\"endpointCode\":\"patient-feedback\",\"endpointName\":\"Submit Patient Feedback\",\"httpMethod\":\"POST\",\"baseUrl\":\"http://localhost:8010\",\"path\":\"/api/mock/hospital/feedback\",\"timeoutMs\":5000,\"retryCount\":1}"
```

---

## 7. Error Handling Testing

### 7.1 Missing Required Field

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/start ^
  -H "Content-Type: application/json" ^
  -d "{}"
```

**Expected:** `400 Bad Request`

```json
{
    "statusCode": 400,
    "message": "domainCode is required"
}
```

### 7.2 Non-Existent Domain

```bash
curl -X POST http://localhost:8010/api/ivr-engine/session/start ^
  -H "Content-Type: application/json" ^
  -d "{\"domainCode\":\"nonexistent_domain\"}"
```

**Expected:** `404 Not Found`

```json
{
    "statusCode": 404,
    "message": "No IVR flow configured for domain: nonexistent_domain"
}
```

### 7.3 Non-Existent Session

```bash
curl http://localhost:8010/api/ivr-engine/session/fake-session-id-999
```

**Expected:** `404 Not Found`

```json
{
    "statusCode": 404,
    "message": "Session not found"
}
```

### 7.4 Error Logs

```bash
curl http://localhost:8010/api/ivr-engine/errors
curl "http://localhost:8010/api/ivr-engine/errors?domainCode=hospital-management&limit=10"
```

---

## 8. Automated Tests (Vitest)

The project includes 47 automated integration tests organized into 4 test files. These tests run against the live NestJS backend and MSSQL database.

### 8.1 Running All Tests

```bash
cd ivr-dashboard
pnpm test
```

**Expected output:**

```
 ✓ server/auth.logout.test.ts (1 test)
 ✓ server/mssql.test.ts (1 test)
 ✓ server/ivr-engine.test.ts (23 tests)
 ✓ server/ivr-routes.test.ts (22 tests)
 Test Files  4 passed (4)
      Tests  47 passed (47)
```

### 8.2 Running a Specific Test File

```bash
pnpm test -- server/ivr-engine.test.ts
```

### 8.3 Test Coverage Summary

| Test File | Tests | What It Covers |
|---|---|---|
| `auth.logout.test.ts` | 1 | Auth cookie clearing |
| `mssql.test.ts` | 1 | Database connectivity to ivr_platform |
| `ivr-routes.test.ts` | 22 | Domains, conversations, hospital tables, agents, intents, rules, prompts, tools |
| `ivr-engine.test.ts` | 23 | Engine health, flow CRUD, API endpoints, hospital sessions, e-commerce sessions, mock APIs, error handling |

### 8.4 Writing Your Own Test

Here is a template for adding a new test to `server/ivr-engine.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

const API_BASE = "http://localhost:8010/api";

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  return { status: res.status, data: await res.json() };
}

describe("My Custom IVR Tests", () => {
  it("starts a banking session and checks balance intent", async () => {
    // Step 1: Start session
    const { status, data } = await fetchJson("/ivr-engine/session/start", {
      method: "POST",
      body: JSON.stringify({ domainCode: "banking" }),
    });
    expect(status).toBe(201);
    expect(data.sessionId).toBeTruthy();
    expect(data.step.nodeType).toBe("prompt");

    // Step 2: Send user input
    const { data: step2 } = await fetchJson(
      `/ivr-engine/session/${data.sessionId}/input`,
      {
        method: "POST",
        body: JSON.stringify({ userInput: "balance" }),
      }
    );
    expect(step2.status).toBe("active");

    // Step 3: End session
    const { data: endResult } = await fetchJson(
      `/ivr-engine/session/${data.sessionId}/end`,
      { method: "POST" }
    );
    expect(endResult.status).toBe("completed");
  }, 15000); // 15s timeout for MSSQL queries
});
```

---

## 9. Postman Collection Setup

For those who prefer a GUI, here is how to set up Postman for testing.

**Step 1:** Create a new Postman Collection named "IVR Platform".

**Step 2:** Set a collection-level variable `baseUrl` = `http://localhost:8010/api`.

**Step 3:** Add the following requests:

| Folder | Request Name | Method | URL | Body |
|---|---|---|---|---|
| Health | Backend Health | GET | `{{baseUrl}}/health` | — |
| Health | Engine Health | GET | `{{baseUrl}}/ivr-engine/health` | — |
| Flows | List All Flows | GET | `{{baseUrl}}/ivr-engine/flows` | — |
| Flows | Flows by Domain | GET | `{{baseUrl}}/ivr-engine/flows?domainCode=ecommerce` | — |
| Flows | Flow Detail | GET | `{{baseUrl}}/ivr-engine/flows/{{flowId}}` | — |
| Sessions | Start Hospital | POST | `{{baseUrl}}/ivr-engine/session/start` | `{"domainCode":"hospital-management"}` |
| Sessions | Send Input | POST | `{{baseUrl}}/ivr-engine/session/{{sessionId}}/input` | `{"userInput":"appointment"}` |
| Sessions | Get State | GET | `{{baseUrl}}/ivr-engine/session/{{sessionId}}` | — |
| Sessions | End Session | POST | `{{baseUrl}}/ivr-engine/session/{{sessionId}}/end` | — |
| Sessions | Active Sessions | GET | `{{baseUrl}}/ivr-engine/sessions/active` | — |
| Mock - Hospital | Book Appointment | POST | `{{baseUrl}}/mock/hospital/book-appointment` | `{"department":"Cardiology","date":"2026-04-01"}` |
| Mock - Hospital | Lab Reports | POST | `{{baseUrl}}/mock/hospital/check-lab-reports` | `{"patientId":"PAT-001"}` |
| Mock - Banking | Check Balance | POST | `{{baseUrl}}/mock/banking/check-balance` | `{"accountNumber":"1234567890"}` |
| Mock - Banking | Fund Transfer | POST | `{{baseUrl}}/mock/banking/fund-transfer` | `{"amount":5000,"beneficiary":"John"}` |
| Mock - E-Commerce | Order Status | POST | `{{baseUrl}}/mock/ecommerce/order-status` | `{"orderId":"ORD-2026-001"}` |
| Errors | Error Logs | GET | `{{baseUrl}}/ivr-engine/errors?limit=10` | — |

**Tip:** In the "Start Hospital" request, add a **Test script** to auto-capture the session ID:

```javascript
var jsonData = pm.response.json();
pm.collectionVariables.set("sessionId", jsonData.sessionId);
```

---

## 10. Frontend Simulator (Browser UI)

The Metronic React dashboard includes an **IVR Simulator** page at `/ivr/simulator` that provides a browser-based testing interface.

**How to use it:**

1. Open the Metronic frontend in your browser (typically `http://localhost:5170`).
2. Navigate to **IVR Engine → Flow Simulator** in the sidebar.
3. Select a domain from the dropdown (Hospital, Banking, or E-Commerce).
4. Click **Start Session** to begin.
5. Type your responses in the input field (e.g., "appointment", "Cardiology", "2026-04-01").
6. Watch the conversation transcript build in real-time.
7. Click **End Session** when done.

The simulator calls the same `/api/ivr-engine/session/*` endpoints documented above, so it serves as both a demo tool and a functional test.

---

## 11. Quick Reference: All API Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Health** | GET | `/api/health` | Backend health check |
| **Health** | GET | `/api/ivr-engine/health` | Engine stats (flows, nodes, sessions, errors) |
| **Sessions** | POST | `/api/ivr-engine/session/start` | Start a new IVR session |
| **Sessions** | POST | `/api/ivr-engine/session/:id/input` | Send user input to session |
| **Sessions** | GET | `/api/ivr-engine/session/:id` | Get session state |
| **Sessions** | POST | `/api/ivr-engine/session/:id/end` | End a session |
| **Sessions** | GET | `/api/ivr-engine/sessions/active` | List active sessions |
| **Flows** | GET | `/api/ivr-engine/flows` | List all flows (optional `?domainCode=`) |
| **Flows** | GET | `/api/ivr-engine/flows/:id` | Get flow detail with nodes |
| **Flows** | POST | `/api/ivr-engine/flows` | Create a new flow |
| **Flows** | PUT | `/api/ivr-engine/flows/:id` | Update a flow |
| **Nodes** | POST | `/api/ivr-engine/flows/:id/nodes` | Add a node to a flow |
| **Nodes** | PUT | `/api/ivr-engine/nodes/:id` | Update a node |
| **Nodes** | DELETE | `/api/ivr-engine/nodes/:id` | Delete a node |
| **Actions** | POST | `/api/ivr-engine/nodes/:id/actions` | Add an action to a node |
| **Endpoints** | GET | `/api/ivr-engine/endpoints` | List API endpoints (optional `?domainCode=`) |
| **Endpoints** | POST | `/api/ivr-engine/endpoints` | Create an API endpoint |
| **Endpoints** | PUT | `/api/ivr-engine/endpoints/:id` | Update an API endpoint |
| **Errors** | GET | `/api/ivr-engine/errors` | Get error logs (optional `?domainCode=&limit=`) |
| **Cache** | POST | `/api/ivr-engine/cache/invalidate` | Invalidate flow cache |

---

## 12. PowerShell Equivalents (Windows)

If you are using PowerShell on Windows instead of curl, replace the curl commands with `Invoke-RestMethod`:

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:8010/api/health"

# Start a session
$body = @{ domainCode = "hospital-management" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:8010/api/ivr-engine/session/start" -Method POST -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 5

# Send input
$sessionId = $response.sessionId
$input = @{ userInput = "appointment" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8010/api/ivr-engine/session/$sessionId/input" -Method POST -Body $input -ContentType "application/json"

# Get session state
Invoke-RestMethod -Uri "http://localhost:8010/api/ivr-engine/session/$sessionId"

# End session
Invoke-RestMethod -Uri "http://localhost:8010/api/ivr-engine/session/$sessionId/end" -Method POST -ContentType "application/json"
```

---

## 13. Troubleshooting

| Problem | Solution |
|---|---|
| `ECONNREFUSED` on port 8010 | NestJS is not running. Start it with `set PORT=8010 && node dist/main.js` |
| `404 No IVR flow configured` | The domain code is wrong. Use `hospital-management`, `banking`, or `ecommerce` |
| `Session not found` | The session expired or was ended. Start a new session |
| Mock API returns 404 | Check the URL pattern: `/api/mock/{domain}/{action}` |
| Tests fail with timeout | Increase `testTimeout` in `vitest.config.ts` (currently 15000ms) |
| Database connection error | Verify MSSQL credentials in `.env` file |
