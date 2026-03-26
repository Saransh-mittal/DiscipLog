# Phase 5: Paper Engineering Journal Directions

## Diagrams to Draw (Boxes & Arrows)

### Diagram 1: The Full Request-Response Loop

Draw this as a vertical flow with boxes connected by arrows. Use two columns if needed: left for "User-facing" and right for "Server-side."

```
[ Browser: AIAssistantV2 ]
        │  POST /api/chat
        │  {messages[], logs[], timezone}
        ▼
[ Next.js Route Handler: /api/chat ]
        │
        ├─→ [ next-auth: getServerSession() ] ──→ [401 Unauthorized if no session]
        │
        ├─→ [ MongoDB: User.findById() ]
        │         + Commitment.find()
        │         [Assembled into: systemPrompt string]
        │
        ├─→ [ OpenAI: gpt-5-nano via streamText() ]
        │
        ▼
[ Browser receives SSE chunks ]  ← smoothStream() interpolates tokens
        │
[ onFinish() fires ]
        │
        ▼  (non-blocking, off the critical path)
[ queueMicrotask → runImplicitMemoryEvaluation() ]
        │
        ├─→ [ MongoDB: LogEntry.find() last 14 days ]
        ├─→ [ OpenAI: gpt-5-nano decide: update memory? ]
        └─→ [ MongoDB: User.findByIdAndUpdate() → implicitMemory ]
```

**Label these edges with:** HTTP method names, SSE, atomic lock

---

### Diagram 2: The `StoredAIProfile` Data Architecture

Draw this as a nested-box diagram (Entity-Relationship style)

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
└─────────────────────────────────────────────────────┘
         ↑
Parsed by getStoredAIProfile(input: unknown): StoredAIProfile
  [Border agent that sanitizes every field before use]
```

---

## What to Write Down (Handwriting-Optimized)

- **"Fire & forget = queueMicrotask → void fn()"** — memory eval runs AFTER response, off critical path
- **"as const + [number] = type vending machine"** — single array → frozen literals → union type derived. One source of truth for DB enum + TS type.
- **"Discriminated union: { ok: true; value: T } | { ok: false; error: string }"** — forces the caller to handle both paths. TypeScript narrows inside if-branch. Called "Railway-Oriented Programming."
- **"Optimistic locking in Mongo: findOneAndUpdate({ field: { $ne: true } }, ...)"** — atomic compare-and-swap. Returns null if already claimed. Prevents race conditions in serverless.

---

## What NOT to Hand-Write

- **Do not write syntax** — no full function signatures, no import statements, no JSX
- **Do not write boilerplate** — things like `mongoose.models.User || mongoose.model(...)` are standard patterns you can regenerate in 5 seconds with AI
- **Do not write the system prompt text** — the actual coaching rules are content, not architecture
- **Do not write field names** — `implicitMemoryLastEvaluatedChatAt` is a name you'll look up; write the *purpose* ("last chat eval timestamp for cooldown logic")
- **Do not copy error handling blocks** — `try/catch` wrappers around logging are mechanical; the insight is *why* errors are logged to an `ErrorLog` collection (separate audit trail; don't lose production errors)
