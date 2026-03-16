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
- Client-side navigation tabs used in the dashboard header to switch between "Overview" (`/dashboard`), "Log" (`/dashboard/log`), and "History" (`/dashboard/history`). 


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
Progress tracking components that calculate logged hours against predefined targets (Interview Prep, Building, Learning, Shipping) and render animated progress bars and completion badges.
- Use local-day comparisons in the browser so edited timestamps move logs between day/week buckets as expected.

### `LogEditorDialog`
Dedicated V2 modal for post-save log management.
- Prefills category, duration, timestamp, transcript, and AI summary from an existing `LogEntry`.
- Uses a browser-local `datetime-local` control for timestamp editing.
- Regenerates draft summaries through `/api/summarize` without persisting them until the user clicks save.
- Persists edits through `PATCH /api/logs/[id]`.

### `LogHistoryV2` (Terminal Ledger)
Chronological feed displaying historical work logs broken down into "All Sessions", "This Week", and "Today" tabs (rendered deeply on `/dashboard/history`). 
- Automatically styles AI summaries using a custom Markdown parser.
- Displays timestamps using `loggedAt ?? createdAt`.
- Includes a graceful degradation fallback displaying truncated raw transcripts if an AI summary is missing.
- Exposes `Edit` and `Delete` actions per card.
- Opens `LogEditorDialog` for in-place correction of duration, transcript, summary, and timestamp.
- Uses a destructive confirmation dialog before permanent deletion through `DELETE /api/logs/[id]`.
- Renders both manual and sprint logs from the same shared `LogEntry` feed.

### `AIAssistantV2`
Floating productivity coach panel powered by **OpenAI (`gpt-5-nano`)**. 
- Integrated with `@ai-sdk/react` (`useChat`) for robust real-time streaming capability via `toUIMessageStreamResponse()` and `smoothStream()` pacing.
- **Premium UI/UX:** Boasts a glassmorphic aesthetic inspired by modern design trends, including animated "Thinking..." bouncing dots during reasoning phases, fade-in message entrance animations, an active blinking cursor during generation, and continuous `requestAnimationFrame` auto-scrolling.
- **Dynamic Context:** Automatically tracks user state and binds the latest manual and sprint logs, target quotas, and timezone to the `sendMessage` body payload on every request, ensuring the AI insights are aggressively up-to-date and temporally accurate.

### `GlobalErrorBoundaryV2`
Terminal-styled error boundary that provides localized graceful degradation. Captures stack traces, renders a user-friendly crash screen, and allows users to submit context directly to the MongoDB error sink.
