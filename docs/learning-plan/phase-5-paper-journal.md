# Phase 5: Paper Engineering Journal Directions

> This is your **handwriting-optimized revision sheet**. Every diagram is meant to be drawn with boxes & arrows on paper. Every bullet under "What to Write Down" is a **mental model** — a principle that compresses a complex system into one recallable sentence. If you can reconstruct these from memory, you understand the architecture well enough to extend it and explain it in interviews.

---

## Diagrams to Draw (Boxes & Arrows)

### Diagram 1: The Unified AI Chat Request Flow

Draw this as a vertical flow. Use two columns if needed: left for "User-facing" and right for "Server-side." This is the **single most important diagram** in the project — it covers the unified SSOT route that handles both coach and recall modes.

```
[ Browser: AIChatDrawer ]
        │  POST /api/ai-chat
        │  {messages[], timezone, mode, recallCardId?, preferredModel?}
        ▼
[ /api/ai-chat route.ts ]
        │
        ├─→ [ getServerSession() ] ──→ [401 if no session]
        │
        ├─→ [ checkAIChatRateLimit(userId, plan) ]
        │      Free: 50/day │ Pro: 150/day
        │      (Upstash Redis sliding window)
        │      ──→ [429 if exceeded]
        │
        ├─→ [ resolveChatModel(plan, preferredModel) ]
        │      Free → gpt-5-nano (ALWAYS, ignore client)
        │      Pro  → gpt-5-mini or gpt-5 (from DB, not client)
        │
        ├─ MODE BRANCH ────────────────────────────────
        │   ┌─ mode === "coach" ──────────────────────┐
        │   │ buildCoachSystemPrompt()                 │
        │   │   ├─ getBaselineCoachContext()            │
        │   │   │    recent logs, weekly stats,         │
        │   │   │    commitments, implicit memory       │
        │   │   └─ Register tools:                      │
        │   │        searchHistoricalLogs (semantic)     │
        │   │        getCoachStats (deterministic)       │
        │   │   toolChoice: "auto"                       │
        │   │   stopWhen: stepCountIs(4)                 │
        │   └──────────────────────────────────────────┘
        │   ┌─ mode === "recall" ─────────────────────┐
        │   │ buildRecallSystemPrompt()                │
        │   │   ├─ card data + source log              │
        │   │   ├─ related logs (cosine similarity)    │
        │   │   └─ NO tools. Context-only.             │
        │   │ Off-topic → [REDIRECT] prefix response   │
        │   └──────────────────────────────────────────┘
        │
        ├─→ [ streamText() → OpenAI ]
        │      Pro: providerOptions.reasoningEffort = "medium"
        │      smoothStream() for token pacing
        │
        ▼
[ SSE stream → Browser ]
        │
        ├─ Text chunks (answer)
        ├─ Tool activity parts → ToolCallAccordion (coach only)
        └─ Reasoning parts → ReasoningAccordion (pro only)
        │
[ onFinish() — coach only, non-blocking ]
        └─→ queueMicrotask → scheduleImplicitMemoryRefreshFromChat()
```

**Label these edges with:** HTTP method, SSE, mode discriminant, model resolution, fire-and-forget

---

### Diagram 2: The `StoredAIProfile` Data Architecture

Draw this as a nested-box diagram (Entity-Relationship style).

```
┌─────────────────── User Document ───────────────────┐
│                                                     │
│  name, email, image                                 │
│  categories: [ { name, dailyTarget, icon }, ... ]   │
│  onboardingCompleted: boolean                       │
│                                                     │
│  ┌──────────── aiProfile (embedded) ─────────────┐  │
│  │ persona: "mentor" | "analyst" | ...           │  │
│  │ coreWhy: string                               │  │
│  │ customInstructions: string                    │  │
│  │                                               │  │
│  │ implicitMemory: string (≤500 chars)           │  │
│  │ implicitMemoryUpdatedAt: Date | null          │  │
│  │ implicitMemoryLastEvaluatedLogAt: Date | null │  │
│  │ implicitMemoryLastEvaluatedChatAt: Date | null│  │
│  │ implicitMemoryPending: boolean  ← LOCK FLAG   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────── subscription (embedded) ──────────┐  │
│  │ plan: "free" | "pro"                          │  │
│  │ preferredModel: "gpt-5-mini" | "gpt-5"       │  │
│  │ upgradedAt: Date | null                       │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────── usagePattern (embedded) ──────────┐  │
│  │ avgLogHour: number                            │  │
│  │ dayOfWeekAvgHour: [7 numbers]                 │  │
│  │ sampleSize: number (drives deviation window)  │  │
│  │ inferredTimezone: string                      │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  smartRecall: { tutorialSeenAt: Date | null }       │
└─────────────────────────────────────────────────────┘
         ↑
Parsed by getStoredAIProfile(input: unknown): StoredAIProfile
  [Border agent that sanitizes every field before use]
```

---

### Diagram 3: Tool-Calling Retrieval Fallback Chain

Draw this as a vertical flow with three horizontal layers representing fallback tiers. This is the **graceful degradation** pattern for the AI Coach's historical search.

```
Model decides it needs historical evidence
        │
        ▼
searchHistoricalLogs(query, categories, dateRange)
        │
        ├─ TIER 1: Atlas Vector Search ($vectorSearch)
        │    query → text-embedding-3-small → vector
        │    → Atlas $vectorSearch index on coachEmbedding
        │    [FAST, most relevant — but requires Atlas index to be up]
        │
        ├─ TIER 2: App-Side Cosine Similarity
        │    query → embedding → dot product against
        │    stored coachEmbedding[] on LogEntry docs (in-memory)
        │    [RELIABLE fallback — works even if Atlas index is slow]
        │
        └─ TIER 3: Keyword + Category Fallback
             regex text match on rawTranscript/aiSummary
             + category filter on MongoDB
             [ALWAYS works — lowest quality, broadest net]
        │
        ▼
Ranked, deduplicated results
        │
        ▼
Model sees evidence → writes grounded answer
```

**Key principle:** Production retrieval must degrade gracefully. Never rely on one mechanism.

---

### Diagram 4: Smart Recall State Machine

Draw this as a state machine with three states and transitions between them.

```
User logs 3+ sessions ──→ [UNLOCK]
        │
        ▼
Server generates SmartRecallCard per uncovered log
    sourceLogId (1:1), rarity: spark | forge | boss
        │
        ▼
    ┌──────────────────────────────────────┐
    │          status: "due"                │
    │          dueAt ≤ now                  │
    └──────┬───────────────────┬───────────┘
           │                   │
     [Got it]             [Need again]
           │                   │
           ▼                   ▼
    ┌──────────────┐   ┌───────────────────┐
    │  "completed"  │   │    "snoozed"       │
    │ completedAt=  │   │  dueAt += 1 hour   │
    │    now        │   │  snoozeCount++      │
    └──────────────┘   └────────┬──────────┘
                                │
                           (dueAt expires)
                                │
                                ▼
                        Promoted back to "due"

Ask AI drawer available AFTER card revealed:
  - Uses unified AIChatDrawer in recall mode
  - High chat interaction → heuristically lower snooze interval
```

**Overview widget states:** `locked` → `ready` → `scheduled` → `cleared`

---

### Diagram 5: Motivation Engine — Autonomous Nudge Pipeline

Draw this as a vertical pipeline. The critical insight is that this system runs **without the user having the app open**.

```
  cron-job.org (hourly ping)
        │
        ▼
  POST /api/cron/daily-nudge
  [CRON_SECRET Bearer token verify — reject unauthorized]
        │
        ├─ 1. Find users whose LOCAL HOUR matches a nudge tier
        │      (requires: usagePattern.inferredTimezone)
        │
        │    Established users (sampleSize ≥ 5):
        │      warmup  → 2h BEFORE avg log time
        │      core    → missed avg by deviation margin
        │      last_call → approaching 10 PM local
        │
        │    New users (sampleSize < 5):
        │      early_spark  → 2 PM local
        │      evening_check → 6 PM local
        │
        ├─ 2. Progressive Deviation Window
        │      < 5 logs:  ±3 hours (uncertain)
        │      < 10 logs: ±2 hours
        │      > 10 logs: ±1.5 hours (confident)
        │
        ├─ 3. Gather context (logs today, coreWhy, implicitMemory)
        │
        ├─ 4. LLM generates persona-matched message
        │      (Goggins voice ≠ Mentor voice ≠ Analyst voice)
        │
        ├─ 5. Save Nudge to MongoDB
        │      (unique: userId + dateKey + tier — no duplicates)
        │
        └─ 6. Dispatch Web Push
              │  web-push library + VAPID keys
              │  → browser push service (Apple/Google/Mozilla)
              │  → sw.js (Service Worker)
              ▼
        User's phone/browser shows OS notification
              │
              ▼
        User opens app → FrictionBanner renders unacknowledged nudge
              │
        [Dismiss] → PATCH /api/nudges/[id]/dismiss
                     sets dismissedAt ← FOREGROUND/BACKGROUND SYNC POINT
```

---

### Diagram 6: Momentum → World-Tier CSS Injection

Draw this as a three-layer stack: Data → Skin Selection → CSS Consumption.

```
LogEntry[] (all user logs)
        │
        ▼
MomentumProvider computes:
  ├─ streakPower (consecutive days with ≥1 log)
  └─ dailyEnergy (hours today / daily target)
        │
        ▼
WorldRenderer selects world skin from tier table
  Tier 1: Stone Foundations (low streak)
  Tier 2: Iron Forge
  Tier 3: Crystal Spire
  Tier 4: Obsidian Sanctum (high streak)
  ...etc
        │
        ▼
Injects --world-* CSS custom properties on :root
  --world-surface          (card backgrounds)
  --world-surface-raised   (elevated elements)
  --world-border           (borders)
  --world-accent           (primary color)
  --world-accent-glow      (glow effects)
  --world-text-primary     (text colors)
  --world-shadow-card      (shadows)
  --world-border-radius    (shape)
  --world-spacing          (padding/margins)
        │
        ├─→ <WorldCard>: reads vars → auto-styles any card
        ├─→ useMomentumClasses(): returns dynamic class strings
        └─→ Raw CSS: background: var(--world-surface, fallback)
```

**Key principle:** The theming system is **data-driven** — change logs → change streak → change world → change every visual surface. No component knows which world it's in; they all read CSS variables.

---

### Diagram 7: DNS Resolution & CDN Proxy Chain

Draw this as a horizontal flow from browser to origin, showing each hop.

```
User types disciplog.com
        │
        ▼
1. Browser DNS cache (hit? → skip to TCP)
        │ miss
        ▼
2. OS DNS cache
        │ miss
        ▼
3. Recursive Resolver (ISP / 1.1.1.1)
        │
        ├─ Root Name Servers (→ "ask .com TLD")
        ├─ .com TLD Servers (→ "ask Cloudflare NS")
        └─ Authoritative NS: Cloudflare
              eugene.ns.cloudflare.com
              Returns Cloudflare's PROXY IP (not Railway's real IP)
        │
        ▼
4. Browser → TCP + TLS to Cloudflare Edge
        │     (Full Strict SSL: Cloudflare validates Railway's cert)
        │
        ├─ Static assets? → served from Cloudflare cache (CDN)
        │     (~20ms vs ~200ms to origin)
        │
        └─ Dynamic API? → proxied to Railway origin
              CNAME: disciplog.com → qj0word5.up.railway.app
              (CNAME Flattening at apex domain)
        │
        ▼
5. Railway processes request → response flows back through Cloudflare
```

**Key records you set up:**
| Record | Purpose |
|---|---|
| NS → Cloudflare | Hand DNS authority to Cloudflare |
| CNAME → Railway | Point traffic to your app host |
| TXT → `_railway-verify` | Prove domain ownership to Railway |
| A (deleted) | Removed Hostinger's parking page IP |

---

## What to Write Down (Handwriting-Optimized)

> These are the mental models worth remembering for interviews. Each is a **principle**, not syntax. If you can explain the "why" behind each, you can answer any follow-up.

### Architecture & Systems Design

- **"Fire & forget = queueMicrotask → void fn()"** — memory eval runs AFTER response, off critical path. User gets their answer whether or not the inspector does anything. This is why the UI feels snappy despite a second AI call running behind the scenes.

- **"Baseline context = always injected. Tool context = fetched on demand."** — keep the always-needed context small and reliable (recent logs, weekly stats, commitments). Let tools fetch deeper evidence when the model decides it needs them. That's what makes the system scalable and accurate. Don't stuff everything into the prompt.

- **"Stats tool ≠ RAG tool"** — RAG finds *relevant* logs via semantic similarity. Stats compute *exact* counts via MongoDB aggregation. The model needs both because you can't count from embeddings and you can't find patterns from aggregations.

- **"Retrieval fallback chain: Vector → Cosine → Keyword"** — production systems degrade gracefully. If Atlas vector search is unavailable, fall back to app-side cosine similarity on stored embeddings. If that's thin, fall back to keyword/category regex. The system should never silently return nothing.

- **"SSOT + discriminated union = one component, two modes"** — `AIChatDrawer` handles coach AND recall via `ChatMode: { type: "coach" } | { type: "recall"; cardId }`. Same backend route, same frontend component. Extending is additive (add a variant), not duplicative (no new route/component). Applied at both backend (`/api/ai-chat` branches by `mode`) and frontend.

- **"Background ↔ Foreground sync via acknowledgedAt flags"** — cron writes a record (Nudge/Debrief). Client polls for unacknowledged ones. User dismisses → sets `acknowledgedAt`. The cron doesn't know about the UI; the UI doesn't know about the cron. They communicate entirely through DB state.

### TypeScript & Type Safety

- **"as const + [number] = type vending machine"** — single array → frozen literals → union type derived. One source of truth for DB enum + TS type. Change the vending machine (the array), everything stays in sync.

- **"Discriminated union: { ok: true; value: T } | { ok: false; error: string }"** — forces the caller to handle both paths. TypeScript narrows inside if-branch. Called "Railway-Oriented Programming." The traditional `throw` alternative is easy to forget in `try/catch`.

- **"Parse, don't validate: getStoredAIProfile(input: unknown) → StoredAIProfile"** — every field is actively verified, not just assumed. The function *cannot* return a malformed profile. Runtime + TypeScript agree. This converts untrusted DB data (from `.lean()`) into a typed contract. The border agent pattern.

- **"ReturnType<typeof fn> as a forward reference"** — instead of importing and rewriting the type, declare the parameter as "whatever this function returns." If the return type changes, all consumers automatically update at compile time.

### Distributed Systems & Concurrency

- **"Optimistic locking in Mongo: findOneAndUpdate({ field: { $ne: true } })"** — atomic compare-and-swap. Returns null if already claimed. Prevents two Docker containers from both triggering an expensive memory evaluation for the same user. This is the same pattern as distributed mutex, but using MongoDB's atomic operations instead of a separate lock service.

- **"Never trust the client for authorization: server reads plan from DB"** — `resolveChatModel()` ignores the client's `preferredModel` if `user.subscription.plan !== "pro"`. The server is the trust boundary. The client value is UI sugar for convenience, not a security input.

### Adaptive Behavior & Intelligence

- **"Progressive deviation = adaptive system behavior"** — less data → wider tolerance (±3h), more data → tighter tolerance (±1.5h). The Motivation Engine gets smarter about when you've deviated from routine as its confidence in your pattern grows. Same principle as Bayesian priors narrowing with more evidence.

- **"Context window compaction: keep messages[0] + messages.slice(-N)"** — the AI remembers the original premise (system context) but forgets the middle of the conversation. Keeps token budget stable and performant. The magnifying glass only fits N paragraphs at a time.

### Feature Design

- **"Additive feature layering for Pro: same code path, different inputs"** — Pro features don't fork the codebase. The difference is: which model is resolved, which rate limit prefix is used, whether reasoning options are passed, and whether the UI renders the ReasoningAccordion. Clean additive design means extending Pro never breaks Free.

---

## What NOT to Hand-Write

- **Do not write syntax** — no full function signatures, no import statements, no JSX
- **Do not write boilerplate** — things like `mongoose.models.User || mongoose.model(...)` are standard patterns you can regenerate in 5 seconds with AI
- **Do not write the system prompt text** — the actual coaching rules are content, not architecture
- **Do not write field names** — `implicitMemoryLastEvaluatedChatAt` is a name you'll look up; write the *purpose* ("last chat eval timestamp for cooldown logic")
- **Do not copy error handling blocks** — `try/catch` wrappers around logging are mechanical; the insight is *why* errors are logged to an `ErrorLog` collection (separate audit trail; don't lose production errors)
- **Do not write CSS variable names** — `--world-surface-raised` is a name you'll look up; write the *pattern* ("Momentum injects CSS custom props on :root, every component reads them with var() fallbacks")
- **Do not write Zod schemas** — the tool input schemas are boilerplate; write the *lesson* ("server validates tool inputs with Zod before the execute() runs → the model can't trick the backend into running arbitrary queries")

---

## Revision Self-Test

After drawing all 7 diagrams and writing all 15 bullets from memory, test yourself:

- [ ] Can you explain why baseline context and tool context are separate layers?
- [ ] Can you explain the 3-tier retrieval fallback and when each tier activates?
- [ ] Can you trace a Smart Recall card from log creation → due → snoozed → completed?
- [ ] Can you explain how the Motivation Engine decides *when* to nudge without hardcoded times?
- [ ] Can you explain why `acknowledgedAt` is the sync mechanism between cron and UI?
- [ ] Can you explain why the server ignores the client's `preferredModel` for free users?
- [ ] Can you explain the DNS resolution chain from `disciplog.com` to Railway's origin?
- [ ] Can you explain why Full (Strict) SSL prevents redirect loops that Flexible would cause?
- [ ] Can you explain why `findOneAndUpdate({ $ne: true })` prevents double-writes across containers?
