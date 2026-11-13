# Telephony & Escalation

How a real phone call reaches the IVR, and how a caller gets handed to a human.

Both features live in the NestJS backend (`backend-nestjs/`) and are driven from the
Metronic frontend (`typescript/vite/`).

---

## 1. Setup

### 1.1 Database

The escalation lifecycle and the telephony tables need migration 004:

```powershell
cd backend-nestjs
npm run db:migrate            # applies database/mssql/004_escalation_telephony.sql
```

The migration is idempotent — every `ALTER`/`CREATE` is guarded — so it is safe to
re-run. On a brand-new database run everything in order instead:

```powershell
npm run db:migrate:all
```

### 1.2 Environment

Copy `.env.example` to `backend-nestjs/.env` and fill in at minimum:

| Variable | Why it matters |
|---|---|
| `PUBLIC_BASE_URL` | The HTTPS URL Twilio calls. Also used to build the transfer callback, so a live escalation cannot move the call without it. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | REST access (call redirect) and webhook signature verification. |
| `TWILIO_CALLER_ID` | Caller ID presented to the agent on transfer. Must be a number you own at Twilio. |
| `TELEPHONY_FALLBACK_AGENT_NUMBER` | Where callers go when no agent has a direct dial. |
| `AZURE_OPENAI_*` | The realtime voice model that actually talks to the caller. |

`GET /api/telephony/config` reports which of these are missing, and the **Telephony**
page shows the same thing as a banner — check it before the first test call.

### 1.3 Point a phone number at the IVR

1. Start the backend (`npm run start:dev`) and expose it publicly. In development:
   `ngrok http 8010`, then set `PUBLIC_BASE_URL` to the HTTPS URL it prints.
2. Open **Common IVR → Telephony** in the UI and connect the number to a domain.
3. In the Twilio console, on that phone number, set:
   - *A call comes in* → `POST {PUBLIC_BASE_URL}/api/telephony/voice/incoming`
   - *Call status changes* → `POST {PUBLIC_BASE_URL}/api/telephony/voice/status`

   Both URLs are shown, ready to copy, in the Telephony page's **Provider setup** card.
4. Call the number.

A number that has not been mapped still answers, using `TELEPHONY_DEFAULT_DOMAIN`, so a
freshly provisioned number is never dead — but the greeting and intents will be generic.

---

## 2. What happens on a call

```
caller ──PSTN──▶ Twilio ──webhook──▶ POST /api/telephony/voice/incoming
                                        │  resolves number → domain, logs CallSession
                                        ▼
                            TwiML <Connect><Stream>
                                        │
        Twilio media (G.711 μ-law) ◀────┴────▶ wss://host/telephony/media
                                                   │  TelephonyBridgeService
                                                   ▼
                                        Azure OpenAI realtime session
                                        (domain prompt + intents + rules,
                                         escalate_to_human tool)
```

Audio is relayed without transcoding: the realtime session is configured with
`g711_ulaw` in both directions, matching what Twilio sends. Caller transcripts and
assistant replies are written to `ConversationMessages`, so a phone call produces the
same conversation record as a web session and shows up in **Conversations**.

Barge-in works: when the model detects the caller has started speaking, the bridge sends
Twilio a `clear` event so the buffered reply is dropped instead of talking over them.

---

## 3. Escalation

### 3.1 What triggers it

| Trigger | Source | Priority |
|---|---|---|
| Caller asks for a person ("talk to a human", "operator") | regex detector | high |
| Frustration ("this is useless", "not helping", "complaint") | regex detector | high |
| Medical emergency (chest pain, breathing trouble, …) | regex detector | urgent, skill group `emergency` |
| Fraud (unauthorised transaction, card stolen, …) | regex detector | urgent, skill group `fraud` |
| 3 consecutive unhandled/fallback replies | conversation signals | normal |
| More than 25 turns without resolution | conversation signals | normal |
| The model decides to hand over | `escalate_to_human` tool call | model-chosen |
| A flow `transfer` node executes | IVR flow engine | node metadata |
| An operator raises one from the UI | `POST /api/escalations` | caller-chosen |

The detector (`escalation-detector.service.ts`) runs on every caller utterance and is
deliberately cheap — regex plus two counters — because it sits in the audio path. The
model can also escalate explicitly through the `escalate_to_human` tool, which carries a
reason, priority and summary.

### 3.2 Lifecycle

```
pending ──▶ assigned ──▶ accepted ──▶ resolved
   │            ▲                     ▲
   └──▶ queued ─┘        abandoned ───┘  (caller hung up)
                         failed          (no reachable agent)
```

- **Routing** picks the least-loaded available agent whose skill group matches, breaking
  ties by longest idle. If nobody is free the escalation is queued.
- **Queue draining** happens automatically when an agent goes available or closes a call
  — no polling loop, it is driven by the escalation event bus.
- **Capacity** is tracked per agent (`ActiveEscalations` / `MaxConcurrent`); an agent at
  their cap flips to `busy` and stops receiving work until they close something.
- One conversation holds at most one open escalation, so a caller who asks for a human
  three times does not create three queue entries.

### 3.3 Live phone transfer

For a call, the escalation is only half the job — the caller has to actually reach the
person. When an escalation with a `CallSid` is assigned:

1. `TelephonyService` (listening for `escalation.assigned`) resolves a target: the
   assigned agent's direct dial → the number's escalation number → the global fallback.
2. It calls the Twilio REST API to redirect the live call to
   `POST /api/telephony/voice/transfer/:escalationId`.
3. That endpoint answers with `<Dial>` to the target, which takes the caller off the AI
   media stream and onto the human.
4. The `<Dial>` result comes back to `/voice/transfer-result/:escalationId`: answered
   closes the escalation as resolved; no-answer or busy requeues it for someone else.

If no target is reachable at all, the escalation is marked `failed` and the caller hears
a callback message rather than silence.

### 3.4 Working the queue

**Common IVR → Escalation Console** is the agent desk:

- live queue over `ws://host/ws/agent-desk`, sorted urgent-first then oldest-first
- the transcript the IVR captured, so the agent does not start cold
- assign / accept / requeue / resolve, and a presence toggle that pulls queued work
- wait and handle-time stats

---

## 4. API reference

### Escalations

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/escalations?status=open` | Queue. `status` accepts `open`, `all`, or a concrete status. |
| GET | `/api/escalations/stats` | Queue depth, average wait and handle time. |
| GET | `/api/escalations/:id` | One escalation. |
| POST | `/api/escalations` | Raise one (`conversationId`, `escalationReason`, optional priority/channel/skillGroup). |
| POST | `/api/escalations/:id/assign` | Assign to `agentId`. |
| POST | `/api/escalations/:id/accept` | Agent picks it up. |
| POST | `/api/escalations/:id/close` | `outcome` = `resolved` \| `abandoned` \| `failed`, plus `resolutionNotes`. |
| POST | `/api/escalations/:id/requeue` | Put it back on the queue. |
| POST | `/api/escalations/dispatch` | Manually drain the queue. |

### Agents

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/agents` | All agents with presence and load. |
| GET | `/api/agents/available?skillGroup=` | Routable agents, best candidate first. |
| POST | `/api/agents` | Create (include `phoneNumber` to enable live transfers). |
| PATCH | `/api/agents/:id` | Update details. |
| PATCH | `/api/agents/:id/availability` | Presence toggle; drains the queue when going available. |

### Telephony

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/telephony/voice/incoming` | Twilio inbound-call webhook (signature verified). |
| POST | `/api/telephony/voice/status` | Twilio call-status webhook. |
| POST | `/api/telephony/voice/transfer/:escalationId` | TwiML that dials the human. |
| POST | `/api/telephony/voice/transfer-result/:escalationId` | Dial outcome handling. |
| GET | `/api/telephony/config` | Webhook URLs + readiness check. |
| GET/POST | `/api/telephony/numbers` | Number → domain mapping. |
| PATCH/DELETE | `/api/telephony/numbers/:id` | Update / remove a mapping. |
| GET | `/api/telephony/calls` | Recent call log. |

### WebSocket endpoints

| Path | Used by |
|---|---|
| `/ws?domain=<code>` | Browser IVR studio (PCM16). |
| `/ws/agent-desk` | Escalation console live feed. |
| `/telephony/media` | Twilio media stream (G.711 μ-law). |
| `/ws/realtime` | socket.io gateway. |

---

## 5. Testing without a phone

Automated checks (no database or Twilio account needed):

```powershell
cd backend-nestjs
npm test        # TwiML, webhook signatures, escalation triggers, full queue lifecycle
```

Manual checks against a running backend:

- **Escalation only:** create an agent with a skill group, set them available in the
  console, then `POST /api/escalations` with any conversation id. It should be assigned
  immediately and appear in the console within a second.
- **Queue behaviour:** set every agent offline, raise an escalation (it queues), then
  toggle an agent to available — it should be assigned without any refresh.
- **Webhook shape:** `curl -X POST $PUBLIC_BASE_URL/api/telephony/voice/incoming -d 'To=+1...&From=+1...&CallSid=CA1'`
  with `VALIDATE_TWILIO_SIGNATURE=false` returns the TwiML Twilio would receive.
- **Full call:** Twilio's console has a "Call this number" test, or dial it directly.

---

## 6. Security notes

- Twilio webhooks are rejected unless `X-Twilio-Signature` verifies against
  `TWILIO_AUTH_TOKEN`. Disable only for local testing, via
  `VALIDATE_TWILIO_SIGNATURE=false` — an open webhook lets anyone drive calls and
  transfers through your account.
- The escalation and agent APIs are currently unauthenticated, like the rest of the
  platform APIs. Put them behind the auth layer before exposing the backend publicly.
