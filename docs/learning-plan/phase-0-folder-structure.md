# Phase 0: Folder Structure — What Is Everything and Why

## The Big Picture

Next.js has a special rule: **the folder structure IS the application**. The location and name of a file directly controls:
- What URL it responds to
- Whether it's a page, an API, a layout, or a shared component
- Whether it runs on the server or the browser

This is called the **App Router** convention (introduced in Next.js 13+). Your project uses it fully.

---

## Top-Level: The Root of the Repo

```
DiscipLog/
├── src/                ← All YOUR application code lives here
├── public/             ← Static files served as-is (images, icons)
├── docs/               ← Your documentation (not part of the app)
├── .agents/            ← AI coding assistant config (not part of the app)
├── node_modules/       ← Installed packages (never touch this)
├── .next/              ← Build output (auto-generated, never touch this)
├── package.json        ← Project dependencies + npm scripts
├── tsconfig.json       ← TypeScript compiler settings
├── next.config.ts      ← Next.js framework settings
├── Dockerfile          ← Instructions to package the app for deployment
└── .env.local          ← Secret keys (never commit this to git)
```

**Rule of thumb:** If it's not inside `src/`, it's config, tooling, or documentation — not application logic.

---

## Inside `src/` — The Heart of the App

```
src/
├── app/          ← The Next.js "App Router" — pages AND API routes
├── components/   ← Reusable React UI components + world skins
├── lib/          ← Utility functions, AI logic, push service, and business logic (no UI)
├── models/       ← MongoDB database schemas and types (7 models)
├── hooks/        ← Custom React hooks (speech recognition, push notifications, momentum)
└── middleware.ts ← Runs before every request to check auth
```

---

## `src/app/` — Where Next.js Lives

This is the most important folder to understand. **Every folder inside `app/` becomes a URL route.**

```
src/app/
├── layout.tsx              ← The root HTML shell (wraps EVERY page)
├── page.tsx                ← The homepage: disciplog.com/
├── globals.css             ← Global CSS applied to all pages
├── globals-v2.css          ← V2 design system (CSS variables, world-tier skins, themes)
│
├── (dashboard)/            ← A "route group" (the parentheses mean: no URL segment)
│   ├── layout.tsx          ← Dashboard layout (nav, auth, theme, providers)
│   └── dashboard/
│       ├── [[...tab]]/     ← Optional catch-all for Overview/Log/History tabs
│       │   └── page.tsx    ← disciplog.com/dashboard OR /dashboard/history etc.
│       ├── settings/
│       │   └── page.tsx    ← disciplog.com/dashboard/settings
│       └── preview-momentum/
│           └── page.tsx    ← Momentum world-tier preview page
│
├── onboarding/
│   └── page.tsx            ← disciplog.com/onboarding
├── signin/                 ← Custom sign-in page
├── signout/                ← Custom sign-out page
│
└── api/                    ← All server-side API endpoints live here
    ├── auth/
    │   └── [...nextauth]/
    │       └── route.ts    ← Handles ALL auth routes
    ├── chat/
    │   └── route.ts        ← POST /api/chat  (AI coach with tool-calling)
    ├── logs/
    │   ├── route.ts        ← GET/POST /api/logs
    │   └── [id]/
    │       ├── route.ts    ← PATCH/DELETE /api/logs/[id]
    │       └── summary/
    │           └── route.ts ← POST /api/logs/[id]/summary
    ├── categories/
    │   └── route.ts        ← GET/PUT /api/categories
    ├── onboarding/
    │   └── route.ts        ← POST/PATCH /api/onboarding
    ├── summarize/
    │   └── route.ts        ← POST /api/summarize
    ├── commitments/
    │   └── route.ts        ← GET/POST/PATCH /api/commitments
    ├── recall/
    │   ├── route.ts        ← GET /api/recall (Smart Recall queue summary)
    │   ├── [id]/
    │   │   ├── complete/
    │   │   │   └── route.ts ← POST /api/recall/[id]/complete
    │   │   └── snooze/
    │   │       └── route.ts ← POST /api/recall/[id]/snooze
    │   └── tutorial/
    │       └── seen/
    │           └── route.ts ← POST /api/recall/tutorial/seen
    ├── errors/
    │   └── route.ts        ← POST /api/errors (GlobalErrorBoundary sink)
    ├── push/
    │   ├── subscribe/
    │   │   └── route.ts    ← POST /api/push/subscribe
    │   └── unsubscribe/
    │       └── route.ts    ← POST /api/push/unsubscribe
    ├── nudges/
    │   ├── route.ts        ← GET /api/nudges
    │   └── [id]/
    │       └── dismiss/
    │           └── route.ts ← PATCH /api/nudges/[id]/dismiss
    ├── debriefs/
    │   ├── latest/
    │   │   └── route.ts    ← GET /api/debriefs/latest
    │   ├── history/
    │   │   └── route.ts    ← GET /api/debriefs/history
    │   └── [id]/
    │       └── acknowledge/
    │           └── route.ts ← PATCH /api/debriefs/[id]/acknowledge
    ├── cron/
    │   ├── daily-nudge/
    │   │   └── route.ts    ← POST /api/cron/daily-nudge (secured)
    │   └── weekly-debrief/
    │       └── route.ts    ← POST /api/cron/weekly-debrief (secured)
    ├── end-of-day-review/
    │   └── route.ts        ← GET /api/end-of-day-review
    └── users/
        └── profile/
            └── route.ts    ← GET /api/users/profile
```

### The Key Naming Rules

| Filename | What it means |
|---|---|
| `page.tsx` | A **visible UI page** at that URL. Must export a default React component. |
| `route.ts` | A **server-side API handler** at that URL. Exports `GET`, `POST`, `PUT`, `DELETE` functions. |
| `layout.tsx` | A **wrapper** that persists across page navigations. Renders a nav bar, auth provider, etc. |
| `[...nextauth]` | Square brackets = **dynamic route segment**. `...` = catch-all (matches any sub-path). This captures `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback/google` all in one file. |
| `[[...tab]]` | Double square brackets = **optional catch-all**. It catches all sub-paths JUST LIKE single brackets, but ALSO matches the base URL. Meaning it matches `/dashboard` AND `/dashboard/history`. |
| `(dashboard)` | Parentheses = **route group**. The folder name is invisible in the URL. Used to organize files without affecting the URL. |

---

### 🍱 Deep Dive: What is `(dashboard)` and why does it have parentheses?

#### The Simple Answer (age 10 version)

Imagine your school has lockers. The locker rooms are organized into sections: Section A, Section B, Section C. But the sections are just *labels for the staff* to know where things are — when a student goes to their locker, they just say "Locker 42", not "Section B, Locker 42." The section name doesn't appear in the student's address.

That's exactly what `(dashboard)` is. It's a **label for developers** to organize files. The browser (the student) never sees the parentheses folder name in the URL.

---

#### Without Route Groups — The Problem

Let's say you have a `layout.tsx` (a nav bar + sidebar wrapper) that you want to apply to your dashboard pages, but NOT to your login page or onboarding page.

If you did this naively:

```
src/app/
├── layout.tsx           ← Root layout — wraps EVERYTHING (including login)
├── page.tsx             ← /  (homepage / login)
├── dashboard/
│   └── page.tsx         ← /dashboard
└── onboarding/
    └── page.tsx         ← /onboarding
```

There's no clean way to add a layout that wraps ONLY `dashboard` without affecting `onboarding`. You'd have to put the nav bar logic inside every page manually — messy and repetitive.

---

#### With Route Groups — The Solution

```
src/app/
├── layout.tsx              ← Root layout (wraps everything: login, onboarding, etc.)
├── page.tsx                ← /  (homepage / login)
│
├── (dashboard)/            ← Route group — just a folder to hold the layout. INVISIBLE in URL.
│   ├── layout.tsx          ← Dashboard layout (nav bar, sidebar) — wraps ONLY dashboard pages
│   └── dashboard/
│       └── page.tsx        ← /dashboard  (URL is still /dashboard — NOT /(dashboard)/dashboard)
│
└── onboarding/
    └── page.tsx            ← /onboarding  (NOT wrapped in the dashboard layout)
```

**The URL for `(dashboard)/dashboard/page.tsx` is still `/dashboard`** — the `(dashboard)` part is completely invisible. The parentheses tell Next.js: *"use this folder for organization but don't add it to the URL."*

---

#### The Real Benefit: Shared Layouts Without Shared URLs

The `(dashboard)/layout.tsx` in your actual project wraps its children with things like:
- The `ThemeProvider` (dark/light mode)
- The `AuthProvider` (user session context)
- The `DashboardNav` navigation bar
- Session checking

Without the route group, you'd have two bad options:
1. Put all this wrapping in the root `layout.tsx` → it would also wrap the login/onboarding pages (wrong)
2. Copy-paste the wrapping code into every single dashboard page (terrible tech debt)

The route group gives you a **third, clean option**: a scoped layout that applies to exactly the pages you want.

---

#### Why NOT just put `dashboard/` directly under `app/` without the route group?

Great question. You *could* do this:

```
src/app/
└── dashboard/
    ├── layout.tsx    ← Dashboard layout
    └── page.tsx      ← /dashboard
```

And the URL would be the same: `/dashboard`. So why use `(dashboard)` at all?

**The answer is: because DiscipLog has more than one page that shares the dashboard layout.**

If you later add `/dashboard/history`, `/dashboard/settings`, `/dashboard/calendar` — and they all need the same nav bar and theme wrapper — a route group lets you group them under one shared `layout.tsx` cleanly:

```
src/app/
└── (dashboard)/
    ├── layout.tsx            ← One shared layout for ALL of these
    ├── dashboard/
    │   └── page.tsx          ← /dashboard
    ├── dashboard/history/
    │   └── page.tsx          ← /dashboard/history
    └── dashboard/settings/
        └── page.tsx          ← /dashboard/settings
```

Without the route group, you'd have to put `layout.tsx` inside `dashboard/`, and it would only wrap sub-routes of `/dashboard` — not peer routes like `/calendar` or `/settings` if those lived at the top level.

---

#### When should you use a route group `(name)/`?

Use it when:
1. **You want a shared layout for some pages but not all** — e.g., a nav bar for logged-in pages only
2. **You want to organize files by feature** without breaking URLs — e.g., grouping all auth pages under `(auth)/` even though the URL is just `/login` and `/signup`
3. **You need multiple different layouts** — e.g., `(marketing)/layout.tsx` for public pages and `(app)/layout.tsx` for logged-in pages

Do NOT use it when:
- You're just making one simple page — just put `page.tsx` directly in a regular folder
- You want the folder name to appear in the URL — then use a regular folder without parentheses

---

### 🎣 Deep Dive: What is `[...nextauth]` and why all the brackets/dots?

#### The Simple Answer (age 10 version)

Imagine you work at the post office. Normally, every house gets its own mailbox. 
- Folder `chat` = Mailbox for house #1.
- Folder `logs` = Mailbox for house #2.

But what if a massive apartment building is built, and you don't want to build 50 separate mailboxes? You just put out ONE giant bin that says: **"ALL mail for ANY apartment in this building goes here."**

That's what `[...nextauth]` is. It's a **catch-all bin**. Instead of making 10 different files for login, logout, password reset, etc., you make *one* file that says "catch any URL that starts with `/api/auth/` and send it to me."

---

#### The Breakdown of the Syntax

Next.js routing uses special characters to do powerful things. Let's decode `[...nextauth]`:

1. **`[]` (Square Brackets)**: This means the route is **Dynamic**. 
   - Example: A folder named `[id]` matches URLs like `/user/123` or `/user/abc`. The word inside the brackets is just a variable name you can use in your code.
   - So, `[nextauth]` means it's a dynamic variable named `nextauth`.

2. **`...` (Three dots / Spread operator)**: This makes it a **Catch-All**.
   - Normally, `[id]` only matches *one* URL segment. (`/user/123` works, but `/user/123/settings` does not).
   - Adding `...` tells Next.js to catch *everything* after this point, no matter how many slashes there are.

#### Before and After

**Without `[...nextauth]` (The painful way):**
If you didn't have a catch-all route, to handle authentication you would have to manually create all these files in your codebase:
```
src/app/api/auth/
├── signin/
│   └── route.ts        ← Handles login form
├── signout/
│   └── route.ts        ← Handles logging out
├── callback/
│   ├── google/
│   │   └── route.ts    ← Handles Google login success
│   └── github/
│       └── route.ts    ← Handles GitHub login success
└── session/
    └── route.ts        ← Checks if user is still logged in
```

**With `[...nextauth]` (The magic way):**
Auth libraries like NextAuth.js (which your project uses) are smart enough to handle all those URLs internally. They just need you to point *all* auth traffic to them.
```
src/app/api/auth/
└── [...nextauth]/
    └── route.ts        ← "Send literally anything inside /auth/ to me!"
```

Now, when a user goes to `yourwebsite.com/api/auth/callback/google`, Next.js sees there is no specific folder for `/callback/google`. But it sees the `[...nextauth]` catch-all, so it dumps the request into that file.

Inside your `route.ts`, NextAuth.js takes over, looks at the URL, and says "Ah, this is a Google callback. I know how to handle this!"

#### Summary

- `(dashboard)` = **Invisible Route**. Used to wrap pages in layouts without changing the URL.
- `[...nextauth]` = **Catch-All Route**. Used to funnel dozens of different URLs into a single file so a library can handle them all at once.

---

### 🗂️ Deep Dive: What is `[[...tab]]` and why the DOUBLE brackets?

#### The Simple Answer (age 10 version)

Imagine you are giving directions to a friend: "Go to the treehouse."
If they ask, "Which room in the treehouse?" you might answer: "The balcony."

But what if you wanted a single set of directions that worked whether they asked for a specific room OR if they just wanted to go to the main treehouse entrance?

That's what **double brackets `[[...tab]]`** do. 
- Single brackets `[...tab]` means: *"You MUST give me a sub-path, like `/dashboard/history`."* If a user just goes to `/dashboard`, Next.js throws a 404 Error!
- Double brackets `[[...tab]]` means: *"Catch any sub-path if it exists (`/dashboard/history`), but ALSO catch the main empty path (`/dashboard`)."* It is an **Optional Catch-All**.

---

#### Why did you change your DiscipLog code to use this?

Look at your new folder structure:
```
src/app/
└── (dashboard)/
    └── dashboard/
        └── [[...tab]]/
            └── page.tsx
```

Previously, you likely had multiple pages: one for the main dashboard (`/dashboard`), another for history (`/dashboard/history`), and maybe another for logs (`/dashboard/logs`). This meant you had 3 different `page.tsx` files. If you wanted to share a layout or state between them, they re-rendered every time you switched tabs.

**By using `[[...tab]]`:**
You now have **ONE single `page.tsx` file** handling all of these URLs:
1. `disciplog.com/dashboard` (The `tab` variable is empty/undefined)
2. `disciplog.com/dashboard/history` (The `tab` variable equals `["history"]`)
3. `disciplog.com/dashboard/logs` (The `tab` variable equals `["logs"]`)

Instead of Next.js loading entirely new pages from the server when you click a tab, your single React component reads the URL `tab` variable and just swaps out which UI component it shows on the screen. This makes switching tabs feel instant, like a desktop app!

#### Summary
- `[id]` = Dynamic variable (Matches exactly one sub-path)
- `[...slug]` = Catch-all (Matches one *or more* sub-paths)
- `[[...tab]]` = Optional Catch-all (Matches zero, one, or more sub-paths)

---

### Why can't a folder have both `page.tsx` AND `route.ts`?
Because a URL can't be both a browser page and an API endpoint at the same time. `page.tsx` serves HTML to browsers; `route.ts` serves JSON/streams to API callers.

---

## `src/components/` — Reusable UI Pieces

```
src/components/
├── AIAssistantV2.tsx       ← AI coach chat panel (streaming, tool-calling UI)
├── ToolCallAccordion.tsx   ← Renders tool activity cards inside chat feed
├── ChatMarkdown.tsx        ← Custom Markdown renderer for AI responses & summaries
├── LoggerV2.tsx            ← Manual voice/text work session logging form
├── SprintTimerCard.tsx     ← Pomodoro-style sprint timer (largest component)
├── CalendarV2.tsx          ← Calendar heat map of logged hours
├── DailyProgressV2.tsx     ← Today's progress bar and stats
├── WeeklyProgressV2.tsx    ← Week-level progress display
├── LogHistoryV2.tsx        ← Chronological log feed with edit/delete
├── CommitmentTracker.tsx   ← Weekly commitment card UI
├── SmartRecallFeed.tsx     ← Semantic search ("Recall" tab) for past logs
├── OnboardingFlow.tsx      ← Multi-step AI onboarding wizard
├── SettingsPage.tsx        ← Category CRUD + AI profile settings
├── LogEditorDialog.tsx     ← Modal dialog for editing a log entry
├── MomentumProvider.tsx    ← Streak power + daily energy context
├── MomentumFlame.tsx       ← Animated flame icon reflecting momentum level
├── WorldCard.tsx           ← Auto-applies world-tier card styling
├── FrictionBanner.tsx      ← In-app nudge banner from Motivation Engine
├── WeeklyDebriefModal.tsx  ← Cinematic full-screen weekly performance review
├── DebriefArchive.tsx      ← Historical archive of all past weekly debriefs
├── EndOfDayMicroReview.tsx ← Lightweight end-of-day reflection prompt
├── CompletionCelebration.tsx ← Sprint/log completion animation overlay
├── SoundManager.tsx        ← Audio playback for timer beeps/notifications
├── DashboardClientShell.tsx ← Client shell managing providers + interstitials
├── LogsProvider.tsx        ← React context caching user log entries
├── ThemeProvider.tsx       ← Wraps the app, provides dark/light theme context
├── ThemeToggle.tsx         ← The button that switches themes
├── DashboardNav.tsx        ← Top navigation for the dashboard
├── AuthProvider.tsx        ← Wraps the app with next-auth's session context
├── CategoriesProvider.tsx  ← React context that shares user categories app-wide
├── DynamicIcon.tsx         ← Renders a Lucide icon by name string
├── GlobalErrorBoundaryV2.tsx ← Catches React crashes and shows a fallback UI
├── ui/                     ← shadcn/ui auto-generated primitives (Button, Dialog, etc.)
└── worlds/                 ← World-tier skin components for each Momentum level
```

**Naming convention:** The `V2` suffix means a component was significantly redesigned. There was a V1, it got replaced but the file name was bumped rather than deleted (common in fast-paced vibe-coded projects). This is mild tech debt — ideally the old ones get deleted.

**Why are these in `components/` and not in `app/`?** Because these components are *reused* across multiple pages. Next.js convention: pages go in `app/`, shared components go in `components/`.

---

## `src/lib/` — Business Logic (No UI Allowed Here)

```
src/lib/
├── mongoose.ts           ← Sets up and caches the MongoDB connection
├── logs.ts               ← Types (DashboardLog, LogSource) + date/timezone utilities
├── ai-profile.ts         ← Types + parsers for the AI coach profile (persona, memory)
├── implicit-memory.ts    ← Background AI memory evaluation engine with optimistic locking
├── coach-context.ts      ← Baseline context builder, query signals, historical retrieval, stats
├── coach-embeddings.ts   ← Vector embedding generation (text-embedding-3-small) for AI Coach retrieval
├── log-summary.ts        ← Shared OpenAI summarization prompt helper
├── momentum.ts           ← Streak power + daily energy computation for Momentum system
├── smart-recall-types.ts ← Shared Smart Recall enums + response types
├── smart-recall.ts       ← Smart Recall queue generation + lifecycle orchestration
├── push-service.ts       ← VAPID-authenticated Web Push notification dispatch
├── usage-patterns.ts     ← Rolling average logging-time analysis for smart nudge timing
├── proactive-insights.ts ← Contextual intelligence for nudge and debrief generation
├── icons.ts              ← Curated icon whitelist for dynamic category AI suggestions
└── utils.ts              ← Generic utility (cn() className helper)
```

**Why separate from `components/`?** Logic in `lib/` has zero React dependencies — it's pure TypeScript functions. This makes it:
1. Testable without rendering a browser
2. Usable from both API routes (server) and React components (client)
3. Easier to reason about because it has no side effects on the DOM

**The rule:** If a function imports React or JSX, it belongs in `components/`. If it's just data transformation, parsing, or API calls, it belongs in `lib/`.

---

## `src/models/` — The Database Layer

```
src/models/
├── User.ts             ← The "users" collection (identity, categories, aiProfile, usagePattern)
├── LogEntry.ts         ← The "logentries" collection (work sessions + embeddings)
├── Commitment.ts       ← The "commitments" collection (weekly goals)
├── Nudge.ts            ← The "nudges" collection (proactive daily nudge records)
├── WeeklyDebrief.ts    ← The "weeklydebriefs" collection (cinematic weekly reviews)
├── PushSubscription.ts ← The "pushsubscriptions" collection (per-device push endpoints)
└── ErrorLog.ts         ← The "errorlogs" collection (server error audit trail)
```

Each file does three things:
1. Defines a **TypeScript interface** (`IUser`, `ILogEntry`) — what the data looks like in code
2. Defines a **Mongoose Schema** — what the data looks like in MongoDB (with validations)
3. Exports a **Mongoose Model** — the object you use to query: `User.findById(...)`, `LogEntry.find(...)`

**The `mongoose.models.User || mongoose.model(...)` pattern** at the bottom of each file is defensive against Next.js hot-reloading: in development, modules re-execute on every save. Without this guard, Mongoose would try to re-register the same model twice and crash.

---

## `src/middleware.ts` — The Gatekeeper

```typescript
// src/middleware.ts
export default withAuth({});
export const config = {
  matcher: ["/dashboard/:path*", "/api/logs/:path*", ...]
};
```

This file runs *before every request* that matches the `matcher` patterns. It checks if the user has a valid session. If not, it redirects to the login page automatically.

**Why does this exist separately from the API routes?** Because it's more efficient. Instead of writing `getServerSession()` checks in every single route file, the middleware intercepts at the edge BEFORE the route handler even boots. It's a single chokepoint for auth.

---

## Mental Model: The File = The URL

```
src/app/api/chat/route.ts
           │    │    │
           │    │    └── exports: POST function (handles POST /api/chat)
           │    └── folder name = URL segment: /chat
           └── folder name = URL segment: /api
```

Every `route.ts` is named identically — the *folder path* is what makes it unique, not the file name. This is intentional Next.js design.

---

## Summary Table

| Folder | Contains | Runs on |
|---|---|---|
| `src/app/*/page.tsx` | UI pages rendered as HTML | Server (RSC) + Client hydration |
| `src/app/api/*/route.ts` | REST API endpoints | Server only |
| `src/components/` | Reusable React UI components | Client (browser) |
| `src/lib/` | Pure TypeScript utilities & logic | Both (imported wherever needed) |
| `src/models/` | MongoDB schemas + TypeScript types | Server only (Mongoose = Node.js) |
| `src/middleware.ts` | Auth guard that runs before every route | Edge (fastest possible) |
