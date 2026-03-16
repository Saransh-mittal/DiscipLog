# API Routes & Database Models

## Database schemas (MongoDB)
### User
- Handles individual identity. Includes `name`, `email`, `image` per NextAuth/Google scope.

### LogEntry
- Maps to a user and a timezone-derived local-day bucket.
- `date`: `YYYY-MM-DD` string derived from `loggedAt` + the caller's timezone and used by dashboard aggregations.
- `hours`: Logged time count.
- `category`: String matching standard work verticals (Interview Prep, Building, Learning, Shipping, Other).
- `rawTranscript`: Stored exact web-speech logged content.
- `aiSummary`: Post-processed analysis text ready for display.
- `source`: `"manual"` or `"sprint"` so the dashboard can distinguish timer-created sessions from direct logs.
- `plannedMinutes`: Optional timer target duration for sprint-created logs.
- `actualMinutes`: Optional realized timer duration for sprint-created logs.
- `startedAt` / `completedAt`: Optional sprint boundary timestamps.
- `completionStatus`: Optional `"completed"` or `"finished_early"` marker for sprint sessions.
- `loggedAt`: ISO timestamp used for timezone-aware day bucketing and chronological sorting.
- `createdAt`: ISO timestamp of exact persistence time.

*Indexing Note:* A compound index `userId` + `date` + `category` will be present to accelerate Calendar view fetching speed.

## Application Endpoints

### `POST /api/logs`
Supports two payload shapes:

**Manual log body:** `{ source: "manual", hours, category, rawTranscript, summary?, loggedAt?, timezone? }`

**Sprint log body:** `{ source: "sprint", category, rawTranscript, summary?, plannedMinutes, actualMinutes, startedAt, completedAt, completionStatus?, timezone? }`

- V2 manual logging sends `loggedAt` and browser `timezone` explicitly so the saved timestamp and day bucket match the user's locale.
- Legacy/manual callers that omit `loggedAt` still fall back to `new Date()` server-side for backward compatibility.
- The frontend still generates the AI summary before save.
- Sprint logs are normalized into standard `LogEntry` rows so the same dashboard, history, heatmap, and AI assistant can read them without a parallel session model.
- For sprint logs, `hours` is derived server-side from `actualMinutes / 60`.
- The server derives `date` from the effective log instant plus the submitted timezone.

### `GET /api/logs`
- Returns the logged-in user's completed `LogEntry` objects for the dashboard, sprint history, calendar, and AI context.
- Results are ordered by `loggedAt` and then `createdAt`.

### `PATCH /api/logs/[id]`
**Body:** `{ hours, category, rawTranscript, aiSummary, loggedAt, timezone }`
- Updates an existing user-owned log entry.
- Used by the V2 log editor modal to change sprint duration, transcript, summary text, and event timestamp.
- Recomputes the persisted `date` bucket from `loggedAt` + `timezone` so "Today", "This Week", heatmap cells, and progress widgets move with the edit.

### `DELETE /api/logs/[id]`
- Permanently deletes a user-owned log entry.
- Used by the V2 history feed's destructive confirmation flow.

### `POST /api/summarize`
**Body:** `{ text, category }`
- Uses the shared `generateLogSummary` helper in `src/lib/log-summary.ts`.
- Calls OpenAI (`gpt-5-nano`) to generate a highly concise, 3-bullet summary of the provided text.
- Powers both new-log summarization and in-editor summary regeneration before the user saves changes.
- Requires `OPENAI_API_KEY` on the server.

### `POST /api/logs/[id]/summary`
- Persisted retry endpoint. Grabs the existing `rawTranscript` from the database and reruns the same shared `generateLogSummary` flow to overwrite a missing/failed `aiSummary`.
- The V2 editor usually regenerates draft summaries through `/api/summarize` first, then persists them via `PATCH /api/logs/[id]`.

### `POST /api/chat`
**Body:** `{ messages, logs, timezone }`
- Productivity coach endpoint. Feeds the user's weekly targets, aggregate stats, and raw transcripts into OpenAI to provide personalized, context-aware advice. Formats event timestamps using `loggedAt ?? createdAt` relative to the user's provided `timezone`.
- Requires `OPENAI_API_KEY` on the server.
