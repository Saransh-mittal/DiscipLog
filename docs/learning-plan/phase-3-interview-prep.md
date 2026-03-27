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
1. **Memory evaluation background jobs** (`runImplicitMemoryEvaluation`) currently run inline using `queueMicrotask`. Because you are deployed on **Railway using a Docker container** (a long-running Node.js process), this fire-and-forget pattern is actually quite safe—the container doesn't freeze when the HTTP response ends (unlike serverless). However, at scale, if the Node container restarts or crashes while a background task is running, that task is lost forever since it's only in memory.
2. **The first service I'd extract:** The implicit memory evaluation loop — into a proper persistent background worker using a message queue (e.g., Redis + BullMQ) so background jobs survive container deployments and restarts.

---

## Question 2: Why use SSE (Server-Sent Events) for AI streaming rather than WebSockets?

**The Question:**
> "You're streaming AI responses from OpenAI to the browser. SSE vs WebSockets — why did you choose SSE and what does that cost you?"

**Senior-Level Answer:**

The Vercel AI SDK's `result.toUIMessageStreamResponse()` uses SSE (HTTP/1.1 chunked transfer, not a persistent WebSocket connection). The choice is optimal for this use case:

**Why SSE wins here:**
- SSE is unidirectional (server → client), which matches the AI stream direction perfectly. No need for bidirectional communication.
- SSE reconnects automatically on drop. WebSockets need custom reconnect logic.
- SSE routes seamlessly through Railway's edge proxy without needing specialized WebSocket load-balancing or timeout configurations.
- SSE is inherently simpler to scale horizontally across multiple Docker containers than WebSockets, as it doesn't require "sticky sessions" or a pub/sub backplane (like Redis) just to stream data.

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
