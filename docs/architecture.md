# DiscipLog Architecture

## Overview
DiscipLog is a robust discipline-logging application designed to be scalable, responsive, and seamless across platforms, relying on artificial intelligence to contextualize time spent. The V2 dashboard is a multi-page application (Overview, Log, History, Settings) that supports direct manual logs, in-app eggtimer-style sprint sessions, post-save log management (edit, regenerate summary, and delete), weekly commitment tracking, a persisted Smart Recall bonus queue, a Momentum/World-tier gamification system, proactive Web Push nudges, and cinematic Weekly Debriefs. All flows converge into the same persisted log model, utilizing AI-facilitated user onboarding and fully dynamic, user-defined categories.

## Core Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** MongoDB (via Mongoose) + MongoDB Atlas Vector Search
- **Auth:** NextAuth (Auth.js) via Google OAuth
- **AI Analytics:** OpenAI (`gpt-5-nano`) server-side — summarization, coaching, tool-calling RAG, nudge generation, weekly debrief narratives, implicit memory evaluation
- **AI SDK:** Vercel AI SDK (`ai` + `@ai-sdk/openai` + `@ai-sdk/react`) for streaming, tool registration, and embeddings
- **UI/UX:** V2 Minimal Typographic design system (Light/Dark themes via `ThemeProvider`) with Momentum gamification world-tier skins
- **Push Notifications:** `web-push` (VAPID) + Service Worker (`public/sw.js`)
- **Background Jobs:** External cron service (cron-job.org) hitting secured `/api/cron/*` routes
- **Deployment:** Docker (Next.js Standalone mode for Railway)

## Environment
- `OPENAI_API_KEY` powers the shared log summarization helper, AI assistant chat endpoint, embeddings, nudge generation, and weekly debrief narratives.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL` are used by the `web-push` library for push notification delivery.
- `CRON_SECRET` secures cron endpoints against unauthorized access.
- MongoDB and NextAuth configuration remain unchanged.

## Philosophy & Stateless Design
### What does it mean to be "Stateless"?
When an application uses traditional session-based logic, the server maintains an active memory bank representing currently logged-in users. When traffic increases and additional servers must spin up, those new servers do not possess the memory of the original server, requiring complicated session-sharing layers (like Redis).

**DiscipLog uses a stateless architecture built on NextAuth JWTs:**
1. A user logs in via Google OAuth.
2. The server issues an encrypted, tamper-proof JSON Web Token (JWT) as a cookie back to the client browser.
3. Because all relevant validation data is inside the secure JWT, the backend servers no longer need any internal memory of the user's login session. Every HTTP request comes with the badge pre-authenticated.
4. **Result:** If this app runs on a PaaS like Railway, it will effortlessly auto-scale. The load-balancer can bounce traffic evenly across 10 active DiscipLog instances without causing any logout loops or session drops.

### Database Strategy
Next.js provides serverless capabilities, functioning more as short-lived AWS Lambda functions rather than a persisting Node.js server. If 5,000 users query the app at once, 5,000 separate DB connection attempts might trigger, quickly wiping out a Mongo cluster's connection limits.
To combat this, the database connection utility introduces a global mongoose cache to aggressively pool connections across hot restarts and API calls.

## Centralized Error Logging (CEL)
DiscipLog utilizes a globally centralized Error boundary to vastly improve UX and developer observability.
Instead of failing silently to standard Next.js 500 pages, errors are ingested into an **ErrorLog** schema within MongoDB. (Note: This is an observability sink, not a strict message queue, as dropped HTTP requests are not reprocessed).

1. **Environment Awareness:** API routes use `NODE_ENV` to determine payload shape. During local development, the full stack trace is returned to the payload so the frontend can render standard Next.js dev overlays. In production, stack traces are scrubbed from the response and secretly logged to the DB instead, responding to the frontend with generic UX-friendly messages.
2. **Client-Side Graceful Degradation:** A `GlobalErrorBoundary` wraps the entire application. When an unexpected crash occurs, users see a high-end UI crash screen containing a textbox. Users can type what they were trying to accomplish when the app crashed; this context is automatically merged with the client-side trace and `POST`ed into `/api/errors`.

## AI Coach Architecture (Tool-Calling RAG)
The AI Coach (`AIAssistantV2`) does not directly read MongoDB. Instead, it uses a hybrid retrieval approach:

1. **Baseline Context:** Always injected into the system prompt — recent logs, weekly stats, commitments, implicit memory, user categories and targets.
2. **Tool-Calling:** The model is given two registered tools (`searchHistoricalLogs`, `getCoachStats`) and decides at runtime whether it needs deeper evidence. Tools are validated with Zod schemas and executed server-side.
3. **Retrieval Fallback Chain:** `searchHistoricalLogs` uses a 3-tier fallback: Atlas vector search → app-side cosine similarity on stored embeddings → keyword/category fallback.
4. **Embeddings:** `coach-embeddings.ts` handles `text-embedding-3-small` vector generation for each log entry, stored as `coachEmbedding` on the `LogEntry` document.
5. **Query Signals:** `buildCoachQuerySignals()` classifies each user query to separate real DB categories from model-invented labels, preventing brittle retrieval.

## Motivation Engine (Phase 3)
DiscipLog transitions from a passive listener into an active companion:

1. **Usage Pattern Recognition:** `usage-patterns.ts` calculates rolling averages of user logging times (global and per-day-of-week) with progressive deviation windows.
2. **Daily Smart Nudges:** Cron-driven, multi-tier nudge system (`warmup` → `core` → `last_call` for established users; `early_spark` → `evening_check` for new users). LLM-generated, persona-matched messages.
3. **Weekly Debriefs:** Sunday cron job computes metrics (hours, consistency, streaks, category breakdowns, trends) and uses LLM to generate dramatic titles, coach notes, and micro-challenges.
4. **Web Push Infrastructure:** VAPID-authenticated push via `web-push`, Service Worker for background delivery, per-device subscription management.
5. **Proactive Insights:** `proactive-insights.ts` provides additional intelligence for nudge and debrief context.

## Momentum / World-Tier Gamification
The `MomentumProvider` computes streak power and daily energy metrics, feeding into the `WorldRenderer` which selects an active world skin and injects `--world-*` CSS custom properties on `:root`. Each world tier applies distinct colors, micro-interactions, and card skins via `WorldCard` and the `useMomentumClasses` hook.

## Smart Recall Architecture
Smart Recall is no longer a stateless "daily deck" destination. It is a persisted queue that lives inside the main productivity flow:

1. **Unlocking:** The feature stays locked until the user has logged at least 3 real sessions.
2. **Coverage:** The server generates one Smart Recall card per uncovered eligible log and stores it in `SmartRecallCard`, tying each card to a single `sourceLogId`.
3. **Queue States:** Cards move through `due`, `snoozed`, and `completed`, allowing the app to show `ready`, `scheduled`, `cleared`, and `locked` states on the Overview bonus widget.
4. **Workflow Integration:** The shared Smart Recall provider listens for log-save events and can auto-open the next due card after manual logs or sprint saves.
5. **Tier-Synced UX:** The recall bonus card, tutorial, and recall session all inherit the active world tier's surfaces, borders, spacing, and motion so the feature feels native to the current momentum skin rather than bolted on.

## Documentation Structure
- `docs/components.md` - Tracks the purpose of shared atomic elements.
- `docs/api.md` - Schema design and routing.
- `docs/oauth-setup.md` - Tutorial for adding Google OAuth keys.
- `docs/MOMENTUM_INTEGRATION.md` - Guide for building world-tier-aware dashboard components.
- `docs/learning-plan/` - 9-phase structured learning curriculum covering the entire codebase.

## Current Logging Flow
1. On the `/dashboard/log` page, users can either create a manual log through `LoggerV2` or run a timed focus block through `SprintTimerCard`.
2. Sprint state is managed client-side for responsiveness and refresh recovery, while persistence still happens only once the user finishes the sprint and submits their notes.
3. Both flows call the shared summarization route, then save into the same `LogEntry` collection.
4. When logs are created or edited, the server stores a canonical UTC `loggedAt` timestamp and derives the `date` bucket from the caller's timezone so local-day widgets remain consistent for the user.
5. After every log save, the server fires background tasks: `scheduleImplicitMemoryRefreshFromLog()` for AI memory evaluation, `scheduleUsagePatternRecalc()` for nudge timing, and `scheduleEmbeddingUpdate()` for vector search indexing.
6. The V2 history feed (on `/dashboard/history`) exposes a dedicated editor modal that can update duration, transcript, AI summary, and timestamp; regenerate draft summaries; and permanently delete user-owned logs.
7. A Settings and Onboarding flow allow users to seamlessly generate their own dynamic tracking categories (e.g. "Piano Practice", "Client Work") with AI-suggested icons and automated weekly tracking quotas.
8. Downstream dashboard systems such as progress widgets, history, heatmap, weekly commitments, Smart Recall, Momentum flame, and AI coaching consume the unified log stream and dynamic user categories rather than separate manual-vs-sprint stores or hardcoded enums.

## Shared Helpers
- `src/lib/log-summary.ts` centralizes the OpenAI summarization prompt used by `/api/summarize` and `/api/logs/[id]/summary`.
- `src/lib/logs.ts` centralizes log enums plus timezone/date helpers such as `deriveLogDate`, `formatLocalDate`, and `sortLogsByTimestamp`.
- `src/lib/ai-profile.ts` — persona types, AI profile parsing, and the `getStoredAIProfile()` defensive parser.
- `src/lib/implicit-memory.ts` — background AI memory evaluation engine with optimistic locking.
- `src/lib/coach-context.ts` — baseline context builder, query signal classifier, historical log retrieval, and stats computation for the AI Coach.
- `src/lib/coach-embeddings.ts` — vector embedding generation and management for AI Coach historical retrieval.
- `src/lib/momentum.ts` — streak power and daily energy computation for the Momentum system.
- `src/lib/smart-recall-types.ts` — shared Smart Recall enums and wire types used by both client and server.
- `src/lib/smart-recall.ts` — Smart Recall queue generation, lifecycle transitions, unlock logic, and API summary shaping.
- `src/lib/push-service.ts` — VAPID-authenticated Web Push notification dispatch.
- `src/lib/usage-patterns.ts` — rolling average logging-time analysis for smart nudge timing.
- `src/lib/proactive-insights.ts` — contextual intelligence for nudge and debrief generation.
- `src/lib/icons.ts` — curated icon whitelist for dynamic category AI suggestions.
- `src/lib/mongoose.ts` — global MongoDB connection pool cache.
- `src/lib/utils.ts` — generic utility (`cn()` className helper).
