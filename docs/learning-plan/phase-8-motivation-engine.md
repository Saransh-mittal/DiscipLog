# Phase 8: Motivation Engine, Cron Jobs, and Web Push

## Objective

Understand how DiscipLog transitions from a **passive listener** (waiting for you to log) into an **active companion** that proactively reaches out using cron jobs, web push notifications, usage pattern recognition, and LLM-driven personalized nudges.

This phase is about understanding **how systems act autonomously**, rather than just reacting to user clicks.

---

## The Big Mental Model

The Motivation Engine does not rely on the user having the app open. 

The architecture works like this:

```txt
       [Background Jobs]
              │
      cron-job.org pings
              ▼
   POST /api/cron/daily-nudge
        (or weekly-debrief)
              │
              ├─ 1. Identify who needs a nudge 
              │     (based on calculated 'usage patterns' and timezone)
              │
              ├─ 2. Gather Context
              │     (RAG: logs today, goals, implicit memory)
              │
              ├─ 3. Generate Personal Message (LLM)
              │     (Persona matched: "Goggins", "Yoda", etc.)
              │
              ├─ 4. Save to Database (Nudge / WeeklyDebrief)
              │
              └─ 5. Dispatch Web Push Notification
                    (Wake up the user's phone/browser)
```

The core lesson:
> **Proactive apps must build their own triggers.** You compute *when* the user usually acts, find the deviation, and use serverless cron jobs to deliver the intervention exactly when friction is highest.

---

## Phase 8.1: Web Push Notification Infrastructure

Start with the delivery mechanism:
- [src/lib/push-service.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/push-service.ts)
- [src/hooks/usePushNotifications.ts](/Users/saranshmittal/Desktop/DiscipLog/src/hooks/usePushNotifications.ts)
- [public/sw.js](/Users/saranshmittal/Desktop/DiscipLog/public/sw.js)

### What to look for

1. **VAPID Keys (`web-push`)**: How the server authenticates itself to browser push services (Apple, Google, Mozilla).
2. **Service Worker (`sw.js`)**: Runs in the background even when the tab is closed. Listens for `push` events and shows the OS-level notification. Listens for `notificationclick` and focuses/opens the PWA.
3. **Database State**: We track push subscriptions per user in `PushSubscription` because a single user might have the app installed on their phone *and* their laptop.

### The design lesson
Push notifications require a handshake. The client requests permission, gives the server a special endpoint URL, and the server blindly fires encrypted payloads at that URL until it returns a `410 Gone` (meaning the user revoked permission).

---

## Phase 8.2: Usage Pattern Recognition

Now look at how the app knows *when* to ping you:
- [src/lib/usage-patterns.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/usage-patterns.ts)

### What happens here

1. **Fire-and-forget recalculation**: Every time you log, the server triggers `scheduleUsagePatternRecalc` (in `api/logs/route.ts`).
2. **Rolling Averages**: It looks at your last 14 days and calculates your `avgLogHour` globally and `dayOfWeekAvgHour` (e.g., normally logs at 9 AM on Mondays).
3. **Progressive Deviation**: As your `sampleSize` grows, the deviation window narrows.
   - < 5 logs: 3 hour grace period
   - < 10 logs: 2 hour grace period
   - \> 10 logs: 1.5 hour grace period (The app knows your routine well, so it ping you sooner if you deviate).

### The design lesson
Hardcoded times (like "ping everyone at 5 PM") don't work for a global, personalized app. The system must natively adapt to the user's unique rhythm and timezone.

---

## Phase 8.3: The Daily Smart Nudge

Open the actual cron endpoint:
- [src/app/api/cron/daily-nudge/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/cron/daily-nudge/route.ts)

### The Multi-Tier Logic

The cron job runs hourly. It checks the user's timezone, their average log time, and determines what "Tier" of notification they need.

**For established users:**
- `warmup`: 2 hours before they usually log. ("Your best focus window is approaching")
- `core`: They missed their window by the deviation margin. ("You usually log by now. Let's get 15 mins in.")
- `last_call`: It's getting late (max 10 PM). ("Day is almost over. Keep the streak alive.")

**For new users:**
- `early_spark` (2 PM)
- `evening_check` (6 PM)

### LLM Generation

It passes `TIER_PROMPTS[tier]`, the user's `coreWhy`, today's logged hours, and `implicitMemory` to an LLM.

Instead of generic push notifications, the user gets a highly contextual message in the exact voice of their selected AI Coach. 

**Security note:** Cron routes must validate `process.env.CRON_SECRET` via Bearer token, otherwise anyone could hit the URL and spam your users.

---

## Phase 8.4: The Weekly Debrief System

Open:
- [src/app/api/cron/weekly-debrief/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/cron/weekly-debrief/route.ts)

This runs on Sundays.

### What it does

1. Gathers all logs for the Mon-Sun week.
2. Calculates exact metrics: total hours, best day, consistency %, category breakdowns, and compares category hours to targets.
3. Finds the "MVP Category" (highest % over target) and fetches previous week comparisons for "Trend Arrows".
4. Sends this raw JSON data to the LLM and asks for:
   - A dramatic week title
   - A personalized coach reflection note
   - Identifying the hardest day specifically
   - One actionable micro-challenge for next week

### The design lesson
Data + Context + AI = High Perceived Value. By turning cold numbers into a personalized narrative, the app builds an emotional bond with the user.

---

## Phase 8.5: The UI Interstitials 

Finally, see how the app handles these server-generated objects in the UI:
- [src/components/FrictionBanner.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/FrictionBanner.tsx)
- [src/components/WeeklyDebriefModal.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/WeeklyDebriefModal.tsx)

### How they work

When the user opens the app (perhaps because they clicked the Push Notification), these client components poll their respective `/api/nudges` or `/api/debriefs/latest` routes.

If there is an un-acknowledged Nudge or Debrief, they render as visually prominent overlays.
Once the user clicks "Start Quickly" or "Acknowledge", it fires a `PATCH /api/.../acknowledge` and animates out.

### UX Takeaway
System-generated events should feel premium. The Weekly Debrief uses a full-screen, staggered-entry glassmorphic modal to make the end-of-week review feel like a significant event that honors the user's hard work.

---

## Your Reading Order

Read in this order:

1. [src/lib/push-service.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/push-service.ts) & [public/sw.js](/Users/saranshmittal/Desktop/DiscipLog/public/sw.js)
2. [src/lib/usage-patterns.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/usage-patterns.ts)
3. [src/app/api/cron/daily-nudge/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/cron/daily-nudge/route.ts)
4. [src/app/api/cron/weekly-debrief/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/cron/weekly-debrief/route.ts)
5. [src/components/WeeklyDebriefModal.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/WeeklyDebriefModal.tsx) & [src/components/FrictionBanner.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/FrictionBanner.tsx)

---

## What "Good Understanding" Looks Like

You've understood this phase when you can explain:

1. How VAPID authenticates payloads to browser push services.
2. Why analyzing usage patterns and local timezones is better than hardcoding "8 AM" notifications.
3. How the multi-tier Nudge system guarantees interventions escalate cleanly.
4. Why blending hard math (metric computation) and LLM generative text creates better weekly reports than pure LLM alone.
5. How Background (serverless cron) state synchronizes with Foreground (client UI) state via `acknowledgedAt` flags.
