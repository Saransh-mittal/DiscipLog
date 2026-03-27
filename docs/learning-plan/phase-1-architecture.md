# Phase 1: Architectural Deconstruction & Data Flow

## Overarching Architecture

DiscipLog is a **Monolithic Full-Stack Application** deployed on a single Next.js process. This is not a microservices architecture—there is no separate backend service. Instead, it uses:

- **Next.js App Router** — both the React frontend *and* the API routes live inside the same repo and same deployment unit
- **MongoDB (via Mongoose)** — the sole data store, accessed directly from API Route Handlers (no separate ORM service layer)
- **OpenAI (via Vercel AI SDK)** — streamed directly from a Route Handler to the browser

**Pattern classification:** Full-Stack Monolith with BFF (Backend for Frontend). All API routes exist purely to serve *this* frontend, not external clients.

---

## Core Data Flow

Here is the complete end-to-end flow of a user chat request:

```
User types in AIAssistantV2.tsx
        │
        ▼
useChat() hook (Vercel AI SDK / @ai-sdk/react)
  sends POST /api/chat with { messages, logs[], timezone }
        │
        ▼
POST /api/chat (route.ts — Next.js Route Handler)
  1. getServerSession() → validates auth via next-auth
  2. buildSystemPrompt() →
       connectToDatabase() → User.findById()
       Commitment.find() → this week's commitments
       Aggregates: weeklyHours, todayTotal, recentLogs[]
       Builds a rich text prompt with persona + memory
  3. streamText() → calls OpenAI gpt-5-nano
  4. result.toUIMessageStreamResponse() → SSE stream back
        │
        ▼
Browser receives chunked text via Server-Sent Events (SSE)
  smoothStream() makes tokens render incrementally
        │
        ▼
onFinish() fires AFTER the stream completes:
  scheduleImplicitMemoryRefreshFromChat()
    → queueMicrotask() (non-blocking)
    → runImplicitMemoryEvaluation() in background
       → possibly calls gpt-5-nano again
       → writes updated implicitMemory to User document
```

**For log creation:** User → LoggerV2.tsx → POST /api/logs → MongoDB write → scheduleImplicitMemoryRefreshFromLog() fires in background.

---

## ✅ Good Architecture Decisions

### 1. Optimistic Implicit Memory via `queueMicrotask`

In `implicit-memory.ts` line 368:
```typescript
function scheduleEvaluation(input: QueueEvaluationInput) {
  queueMicrotask(() => {
    void runImplicitMemoryEvaluation(input);
  });
}
```
**Why this is excellent:** The user receives their streamed chat response immediately. The AI's self-reflection (deciding whether to update the coaching memory) runs *after* the response is sent—completely off the critical path. This is a production pattern used by systems like GitHub Copilot's telemetry: fire-and-forget, non-blocking, zero user-perceived latency cost.

### 2. The `getStoredAIProfile()` Defensive Parser

In `ai-profile.ts`, every field coming from MongoDB goes through explicit parsing and sanitization:
```typescript
export function getStoredAIProfile(input: unknown): StoredAIProfile { ... }
```
**Why this is excellent:** MongoDB's Mongoose `.lean()` returns `unknown`-compatible plain objects. Rather than trusting the schema, this function gracefully handles null, undefined, wrong types, and timestamp coercion (via `parseDate()`). This prevents a class of production bugs where stale or migrated DB documents crash your app due to unexpected field shapes.

### 3. Idempotent Race Condition Lock via MongoDB Atomic Update

In `implicit-memory.ts` lines 280–293:
```typescript
const claimedUser = await User.findOneAndUpdate(
  {
    _id: userId,
    "aiProfile.implicitMemoryPending": { $ne: true },
  },
  { $set: { "aiProfile.implicitMemoryPending": true } },
  { returnDocument: "after" }
).lean();

if (!claimedUser) return; // Another instance already claimed it
```
**Why this is excellent:** In a distributed Docker environment like Railway, multiple container instances can run simultaneously and handle requests for the same user. This atomic compare-and-swap pattern prevents two concurrent requests (even if they hit different containers) from both triggering an expensive memory re-evaluation and creating a double-write. This is a classic distributed systems technique (optimistic locking) applied correctly inside MongoDB.

---

## ⚠️ Anti-patterns / Tech Debt

### 1. `(global as any).mongoose` — Unsafe Global Cache

In `mongoose.ts` lines 5–9:
```typescript
let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}
```
**What's wrong:** Casting `global` to `any` completely bypasses TypeScript. If this global cache is unexpectedly shaped (e.g., a future library also writes to `global.mongoose`), you get a silent runtime bug—no compile-time protection.

**Senior Engineer Refactor:**
```typescript
// types/global.d.ts
declare global {
  var mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}
```
Then use `globalThis.mongoose` with proper typing. This is the standard pattern used in Next.js official MongoDB examples.

### 2. `LocalLogEntry` Interface Duplication in `route.ts`

In `route.ts` lines 35–43, there is a local `LogEntry` interface:
```typescript
interface LogEntry {
  date: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string;
  loggedAt?: string;
  createdAt: string;
}
```
But `src/lib/logs.ts` already defines `DashboardLog` with an overlapping shape. These two types can grow out of sync silently. If someone adds a field to `DashboardLog`, the system prompt in `route.ts` will never see it.

**Senior Engineer Refactor:** Delete the local `LogEntry` interface in `route.ts` and import `DashboardLog` from `@/lib/logs`. Then change `buildSystemPrompt`'s signature:
```typescript
async function buildSystemPrompt(
  logs: DashboardLog[],
  timezone: string,
  userId: string
): Promise<string>
```
Single source of truth. One type change propagates everywhere at compile time.
