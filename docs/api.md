# API Routes & Database Models

## Database schemas (MongoDB)
### User
- Handles individual identity. Includes `name`, `email`, `image` per NextAuth/Google scope.

### LogEntry
- Maps to User and Date.
- `hours`: Logged time count.
- `category`: String matching standard work verticals (Interview Prep, Building, Learning, Shipping).
- `rawTranscript`: Stored exact web-speech logged content.
- `aiSummary`: Post-processed analysis text ready for display.

*Indexing Note:* A compound index `userId` + `date` + `category` will be present to accelerate Calendar view fetching speed.

## Application Endpoints

### `POST /api/logs`
**Body:** `{ hours, category, rawTranscript }`
- Interacts with `src/app/api/summarize` internally to generate summary, then persists log row to DB.

### `GET /api/logs?month=...`
- Returns an aggregated block of completed objects for the UI calendar view based on logged-in user JWT.

### `GET /api/summarize` (Internal)
- Standardized OpenAI wrapper that returns chunked analyses from input transcripts. Used structurally in the creation endpoint.
