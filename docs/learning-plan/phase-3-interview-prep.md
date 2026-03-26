# Phase 3: The "Why" — Interview Prep & Trade-offs

## Question 1: Why use a Monolithic Next.js architecture instead of separate microservices?

**The Question a FAANG interviewer would ask:**
> "DiscipLog has an AI chat feature, a user service, a logging service, and a background memory evaluation job all running in one Next.js repo. Walk me through the trade-offs of this architecture. When would you split it, and what would be the first service you'd extract?"

**Senior-Level Answer:**

The monolith is a deliberate bet on **iteration speed over operational complexity**. At early stage, a monolith offers:
- Single deployment, no inter-service network latency, no distributed tracing overhead
- Shared TypeScript types across the full stack — refactor `DashboardLog` in one file and your API route, your DB model, and your UI all benefit at compile time
- No service discovery, no API gateways, no cross-service auth

**The real trade-off emerges at scale:**
1. **Memory evaluation background jobs** (`runImplicitMemoryEvaluation`) currently run inside the same serverless function that served the request. With Vercel's serverless model, the function *can* be killed before `queueMicrotask` completes. You don't have a background worker — you have a fire-and-forget inside an HTTP response lifecycle. This is acceptable for low-volume but brittle at scale.
2. **The first service I'd extract:** The implicit memory evaluation loop — into a proper queue worker (e.g., an inngest.com function, or a Vercel Cron Job hitting a dedicated route). The API route handler should only *enqueue* the job, not execute it.

---

## Question 2: Why use SSE (Server-Sent Events) for AI streaming rather than WebSockets?

**The Question:**
> "You're streaming AI responses from OpenAI to the browser. SSE vs WebSockets — why did you choose SSE and what does that cost you?"

**Senior-Level Answer:**

The Vercel AI SDK's `result.toUIMessageStreamResponse()` uses SSE (HTTP/1.1 chunked transfer, not a persistent WebSocket connection). The choice is optimal for this use case:

**Why SSE wins here:**
- SSE is unidirectional (server → client), which matches the AI stream direction perfectly. No need for bidirectional communication.
- SSE reconnects automatically on drop. WebSockets need custom reconnect logic.
- SSE works over standard HTTP/2, which multiplexes well. Vercel's CDN/edge handles SSE natively.
- SSE responses are stateless — each chat turn is a fresh HTTP request. This is perfectly aligned with serverless (no persistent connection state to manage).

**What SSE costs you:**
- Browser limit: HTTP/1.1 allows only ~6 concurrent SSE connections per domain. Not a real limit since you only have one chat stream at a time.
- No binary data — but text tokens from OpenAI are text anyway.
- If the user needs *real-time bidirectional* features (e.g., collaborative editing, real-time cursors), SSE won't work. That requires WebSockets or WebRTC.

**The moment to switch to WebSockets:** If you add voice input (streamed audio chunks upstream), you'd need a bidirectional channel.

---

## Question 3: Why store the AI coaching memory inside the User document rather than a separate collection?

**The Question:**
> "Your `implicitMemory` is embedded inside the User document. When would you denormalize like this, and when would it cause problems?"

**Senior-Level Answer:**

**Why embedding is correct here:**
- `implicitMemory` is always fetched *with* the user — no query joins needed. You never need memory without a user.
- It's a bounded subdocument — capped at 500 characters (`MAX_IMPLICIT_MEMORY_LENGTH`). MongoDB documents cap at 16MB; this is not a concern.
- It's written atomically with the user via Mongoose's `findByIdAndUpdate`. No cross-document transaction needed.
- The `implicitMemoryPending` flag serves as a distributed lock — only possible because it lives on the same document, making the atomic `findOneAndUpdate` compare-and-swap reliable.

**When embedding would break:**
1. **High write frequency:** If memory updated on every message (rather than after 3+ logs with cooldowns), the User document would become a hot-write contention point in MongoDB.
2. **Multiple memory types:** If you added "session memory," "topic memory," and "emotion memory" separately, the document would balloon. Then you'd extract a `CoachingProfile` collection.
3. **Analytics queries:** If you needed to query memory content across users (e.g., "how many users have workout patterns?"), embedding makes cross-document aggregation expensive. A separate collection with indexes wins.

**Interview signal:** Always explain *the invariant that makes denormalization safe* — in this case: bounded size, always read with parent, single-writer with atomic lock.
