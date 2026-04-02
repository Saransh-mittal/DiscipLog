# Reusable Components

This document serves as the guide for shared atomic components within DiscipLog's `shadcn/ui` architecture.

## Installation Policy
Only install necessary shadcn components. 
- Use the CLI: `npx shadcn@latest add [component]`

## Presentational Components

### `Button`
Standard button component.
- Used globally for generic actions, form submissions, and logging triggers.

### `Card`
Content container with distinct elevation/borders.
- Used in the calendar grid and summary displays.

### `Input`
Text collection interface.

## Core Modules (V2 Design)

### `ThemeProvider` & `ThemeToggle`
- `ThemeProvider` provides a React context managing the active theme (`light` or `dark`). Uses `localStorage` for persistence and `window.matchMedia` for initial system-preference detection.
- Applies the `.light` or `.dark` class to the HTML root element.
- `ThemeToggle` is a simple Sun/Moon button that reads from the context.
- Components use semantic CSS variables (`var(--v2-surface-...)`) defined in `globals-v2.css` to seamlessly support both themes.

### `DashboardNav`
- Client-side navigation tabs used in the dashboard header to switch between "Overview" (`/dashboard`), "Log" (`/dashboard/log`), "History" (`/dashboard/history`), "Settings" (`/dashboard/settings`), and conditionally "Archive" (when past debriefs exist).

### `DashboardClientShell`
- Client-side wrapper for the dashboard layout that manages global navigation state, debrief interstitials, and provider composition (Categories, Logs, Momentum).

### `CategoriesProvider` & `DynamicIcon`
- `CategoriesProvider` fetches the active user's `categories` array from the database and exposes it via React Context to all dashboard and logging components.
- `DynamicIcon` is a wrapper around `lucide-react` that dynamically renders an icon from a string name, utilizing a curated 40-icon whitelist for AI suggestions and a fallback icon if missing.

### `LogsProvider`
- React context provider that fetches and caches the user's `LogEntry` array, exposing it to all dashboard children via context.
- Provides a `refreshLogs()` method for re-fetching after creates/edits/deletes.

### `OnboardingFlow`
- A minimal, two-step AI-driven setup screen.
- Step 1: User provides a free-text description of how they spend their time.
- Step 2: Renders an editable array of category cards (auto-populated by OpenAI) containing names, AI-suggested icons, and daily/weekly tracking targets. Validates constraints (max 7) before saving.
- Located at `/onboarding`, completely outside the dashboard layout.

### `LoggerV2`
Manual voice / text entry point. Interfaces with the shared Web Speech hook, exposes a custom hours stepper, and saves standard `"manual"` log entries after AI summarization.
- Uses `/api/summarize`, which delegates to the shared `generateLogSummary` helper.
- Sends the browser timezone and a current `loggedAt` timestamp with every save so logs land in the correct local-day bucket.

### `SprintTimerCard`
Eggtimer-style sprint module embedded in the dashboard.
- Starts from a single custom duration input with small preset sprint chips below it.
- Persists active timer state in `localStorage` so running, paused, and finished-but-unsaved sessions can recover after refresh.
- Plays a stronger multi-tone completion beep and can optionally request browser notification permission for background reminders.
- Opens a finish dialog after completion or early finish, asks for category + notes, supports optional dictation, then summarizes and saves the result as a standard `"sprint"` log entry.
- Reuses the same summary pipeline as manual logs before persistence.
- Saves sprint completion metadata (`plannedMinutes`, `actualMinutes`, `startedAt`, `completedAt`, `completionStatus`) into the same `LogEntry` shape used by manual logs.

### `CalendarV2`
Dashboard element dynamically querying logged objects to shade day squares globally. Uses a GitHub-style 12-week heatmap with an amber gradient intensity scale.
- Reads the persisted `date` buckets, which are derived from the user's timezone at save/edit time.

### `DailyProgressV2` & `WeeklyProgressV2`
- Progress tracking components that calculate logged hours against dynamic, user-defined tracking targets generated during onboarding or managed in Settings.
- Render animated progress bars, numerical summaries, and dynamic icons.
- Use local-day comparisons in the browser so edited timestamps move logs between day/week buckets as expected.

### `CommitmentTracker`
- A dedicated dashboard widget allowing users to declare weekly goals (e.g., "Launch version 1.0").
- Users can mark commitments as "Completed" or "Missed".
- If missed, an AI-enhancement layer helps the user rephrase their excuse into a productive, accountable post-mortem statement before saving.

### `SettingsPage`
- Located at `/dashboard/settings`.
- Provides full CRUD interface for the user's `categories` array.
- Allows inline editing of names and targets, icon cycling, and adding new categories manually or via AI prompt.
- Enforces the 7-category hard limit and tracks unsaved changes.

### `LogEditorDialog`
Dedicated V2 modal for post-save log management.
- Prefills category, duration, timestamp, transcript, and AI summary from an existing `LogEntry`.
- Uses a browser-local `datetime-local` control for timestamp editing.
- Regenerates draft summaries through `/api/summarize` without persisting them until the user clicks save.
- Persists edits through `PATCH /api/logs/[id]`.

### `LogHistoryV2` (Terminal Ledger)
Chronological feed displaying historical work logs broken down into "All Sessions", "This Week", and "Today" tabs (rendered deeply on `/dashboard/history`). 
- Automatically styles AI summaries using the `ChatMarkdown` parser.
- Displays timestamps using `loggedAt ?? createdAt`.
- Includes a graceful degradation fallback displaying truncated raw transcripts if an AI summary is missing.
- Exposes `Edit` and `Delete` actions per card.
- Opens `LogEditorDialog` for in-place correction of duration, transcript, summary, and timestamp.
- Uses a destructive confirmation dialog before permanent deletion through `DELETE /api/logs/[id]`.
- Renders both manual and sprint logs from the same shared `LogEntry` feed.

### `AIAssistantV2`
- Floating productivity coach panel powered by **OpenAI (`gpt-5-nano`)**. 
- Integrated with `@ai-sdk/react` (`useChat`) for robust real-time streaming capability via `toUIMessageStreamResponse()` and `smoothStream()` pacing.
- **Tool-Calling UI:** Parses streamed tool parts (`tool-searchHistoricalLogs`, `tool-getCoachStats`) into structured `ToolCallData` objects and renders them as expandable accordion cards via `ToolCallAccordion`.
- **Premium UI/UX:** Boasts a glassmorphic aesthetic inspired by modern design trends, including animated "Thinking..." bouncing dots during reasoning phases, fade-in message entrance animations, an active blinking cursor during generation, and continuous `requestAnimationFrame` auto-scrolling.
- **Dynamic Context:** Automatically tracks user state and binds the latest manual and sprint logs, user-defined category targets, active weekly commitments, and timezone to the `sendMessage` body payload on every request, ensuring the AI insights are aggressively up-to-date and temporally accurate.

### `ToolCallAccordion`
- Renders AI Coach tool activity as expandable accordion cards within the chat feed.
- Displays loading/success/error states with structured detail: query, resolved categories, advisory labels, topic terms, intent tags, retrieval mode, date coverage, and match counts.

### `ChatMarkdown`
- Custom Markdown renderer for AI chat responses and log summaries.
- Renders standard markdown elements (bold, italic, lists, code blocks) with DiscipLog-styled typography.

### `SmartRecallProvider`
- Shared client-side Smart Recall orchestrator mounted inside the world-tier shell.
- Fetches `GET /api/recall`, keeps the queue fresh when snoozes expire, and listens for post-save log events so recall can surface directly after manual logs and sprint saves.
- Owns the one-card-at-a-time recall session modal and the first-run tutorial modal.
- Preserves a stable Smart Recall identity while still inheriting active world-tier surfaces, borders, motion, and spacing through `useWorld()`.

### `RecallBonusCard`
- Overview widget that turns Smart Recall into a visible bonus state inside the main productivity flow.
- Renders the four primary states: `locked`, `ready`, `scheduled`, and `cleared`.
- Shows unlock progress, next recall timing, or finished/empty guidance, and routes the user toward either logging more work or starting recall immediately.

### `SmartRecallFeed`
- Queue/history surface for the dedicated "Recall" tab.
- Uses the shared Smart Recall provider instead of its own fetch loop.
- Shows the current queue broken into `Ready Now`, `Coming Back`, and `Completed Today`.
- Offers entry points for `Start Recall`, tutorial help, and manual refresh, but leaves the actual answer/check flow to the shared modal so the main experience remains one-card-at-a-time.

### `MomentumProvider` & `MomentumFlame`
- `MomentumProvider` computes `streakPower` and `dailyEnergy` from the user's logging history, exposing these values via React context.
- `MomentumFlame` renders an animated flame icon whose intensity and color shift with the user's current momentum level.

### `WorldCard`
- Thin wrapper component that auto-applies world-tier styling: background, border, shadow, border-radius, hover lift, glow, ripple, and card entrance animations.
- Delegates to the active world skin via the Momentum system.

### `CompletionCelebration`
- Animated celebration overlay triggered when a user completes a sprint or logs a session.

### `SoundManager`
- Manages audio playback for sprint timer completion beeps and notification sounds.

### `FrictionBanner`
- Prominent in-app banner that appears when the user has an un-dismissed nudge.
- Displays the LLM-generated motivational message with a CTA button.
- Animates out when dismissed (fires `PATCH /api/nudges/[id]/dismiss`).

### `WeeklyDebriefModal`
- Full-screen, cinematic glassmorphic modal for the weekly performance debrief.
- Staggered-entry animation for each metric section.
- Displays: dramatic week title, total hours, consistency %, best day, category breakdown with progress bars and trend arrows, coach note, MVP category, hardest day, and next-week micro-challenge.
- Internal scroll for overflow prevention. Acknowledges on dismiss via `PATCH /api/debriefs/[id]/acknowledge`.

### `DebriefArchive`
- Historical archive view of all past weekly debriefs.
- Shows each debrief as a card with key metrics and category breakdowns.
- Progress bar colors dynamically match the active world-tier accent.
- Accessible from the "Archive" tab in `DashboardNav` (only visible when past debriefs exist).

### `EndOfDayMicroReview`
- Lightweight end-of-day review component that prompts users for quick reflections on their day's sessions.

### `GlobalErrorBoundaryV2`
Terminal-styled error boundary that provides localized graceful degradation. Captures stack traces, renders a user-friendly crash screen, and allows users to submit context directly to the MongoDB error sink.

## Custom Hooks

### `useSpeechRecognition`
- Custom React hook wrapping the Web Speech API for voice-to-text dictation.
- Used by `LoggerV2` and `SprintTimerCard` for transcript input.

### `usePushNotifications`
- Custom React hook managing Web Push subscription lifecycle.
- Handles permission requests, subscription creation/deletion, and sync with `/api/push/subscribe` and `/api/push/unsubscribe`.

### `useMomentumClasses`
- Returns computed CSS class names (`cardClasses`, `entranceClass`, `allClasses`) and `microInteractions` state based on the active world tier.
- Used by components that need tier-aware styling without wrapping in `WorldCard`.
