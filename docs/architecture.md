# DiscipLog Architecture

## Overview
DiscipLog is a robust discipline-logging application designed to be scalable, responsive, and seamless across platforms, relying on artificial intelligence to contextualize time spent.

## Core Stack
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** MongoDB (via Mongoose)
- **Auth:** NextAuth (Auth.js) via Google OAuth
- **AI Analytics:** OpenAI API server-side
- **Deployment:** Docker (Next.js Standalone mode for Railway)

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

## Documentation Structure
- `docs/components.md` - Tracks the purpose of shared atomic elements.
- `docs/api.md` - Schema design and routing.
- `docs/oauth-setup.md` - Tutorial for adding Google OAuth keys.
