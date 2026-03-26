# Phase 7: AI Coach Tool Calling, RAG, and Evidence Flow

## Objective

Understand how the AI Coach in DiscipLog answers questions using a hybrid architecture:

- baseline context for recent/today/week awareness
- tool-calling for deep history and stats
- retrieval helpers for safe Mongo-backed evidence lookup
- streamed UI rendering for both the answer and tool activity

This phase is about understanding **how the system thinks**, not just where the files are.

---

## The Big Mental Model

The AI Coach does **not** directly read MongoDB on its own.

Instead, the architecture works like this:

```txt
User asks a question
        │
        ▼
POST /api/chat
        │
        ├─ Build baseline context
        │   - recent logs
        │   - weekly stats
        │   - commitments
        │   - implicit memory
        │
        ├─ Register tools for the model
        │   - searchHistoricalLogs
        │   - getCoachStats
        │
        ├─ streamText(...)
        │   - model decides whether to call tools
        │   - backend executes tool safely
        │   - model sees tool result
        │   - model writes final answer
        │
        ▼
UI stream returns to frontend
        │
        ├─ answer text rendered with markdown
        └─ tool activity rendered in accordion cards
```

This is the core lesson:

> The model chooses *what* it needs, but your backend controls *how* that evidence is fetched.

---

## Phase 7.1: Read the Entry Point

Start with:

- [src/app/api/chat/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/chat/route.ts)

This file is the orchestration layer.

### What to look for

1. `POST(req: Request)`
   This is the route handler the chat UI calls.

2. `buildSystemPrompt(...)`
   This prepares the coach’s baseline knowledge before the model starts answering.

3. `streamText({...})`
   This is where the actual model call happens.

4. `tools: { ... }`
   This is where the model is given callable server tools.

5. `toUIMessageStreamResponse({ originalMessages })`
   This sends the streamed result back to the frontend without duplicating assistant messages.

### What you should understand after reading this file

- where auth happens
- where baseline context is injected
- where tools are registered
- where tool logs are emitted
- where the stream is returned to the UI

---

## Phase 7.2: Understand Baseline Context vs Tool Context

Then open:

- [src/lib/coach-context.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/coach-context.ts)

This file contains the real retrieval engine.

### Two layers of context exist

#### 1. Baseline context

Built by:

- `getBaselineCoachContext(...)`

This always gives the model:

- recent logs
- weekly totals
- category summaries
- commitments
- implicit memory
- user categories and targets

This is for questions like:

- “What should I focus on today?”
- “How’s my week looking?”
- “Am I on track?”

#### 2. Tool-fetched context

Fetched only when needed through:

- `searchHistoricalLogs(...)`
- `getCoachStats(...)`

This is for questions like:

- “Analyze my DSA journey so far”
- “What have I learned about Next.js routing?”
- “How many LeetCode problems have I solved?”
- “How has DiscipLog progressed so far?”

### The design lesson

Do not stuff everything into the prompt up front.

Instead:

- keep always-needed context small and reliable
- let tools fetch deeper evidence on demand

That is what makes the system scalable and more accurate.

---

## Phase 7.3: Learn Query Understanding Before Retrieval

In [src/lib/coach-context.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/coach-context.ts), focus on:

- `buildCoachQuerySignals(...)`

This function classifies the incoming request before retrieval starts.

### Important outputs

- `wantsHistorical`
- `wantsStructuredStats`
- `resolvedCategories`
- `advisoryLabels`
- `searchPhrases`
- `topicTerms`
- `intentTags`

### Why this matters

The model may invent labels like:

- `DSA`
- `Problem Solving`
- `Progress`
- `WeeklyStats`

Your DB does not store categories with those exact names.

So this code separates:

- **real stored categories** → `resolvedCategories`
- **model-invented labels** → `advisoryLabels`

That prevents the retrieval layer from becoming brittle.

### Core lesson

Real database structure must stay the source of truth.
Model language is useful, but it should guide retrieval, not override schema reality.

---

## Phase 7.4: Learn the Two Tool Types

Back in [src/app/api/chat/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/chat/route.ts), study the tool registration.

You’ll see this pattern:

```ts
tool({
  inputSchema: z.object({...}),
  execute: async (...) => {...},
})
```

### Tool 1: `searchHistoricalLogs`

Purpose:

- semantic retrieval of older logs
- evidence for journeys, struggles, learning, breakthroughs, and topic history

It calls:

- `searchHistoricalLogs(...)`

This tool is about **relevance**.

### Tool 2: `getCoachStats`

Purpose:

- deterministic counts
- date ranges
- category totals
- examples

It calls:

- `getCoachStats(...)`

This tool is about **structured truth**.

### Why both are needed

RAG alone is not enough for:

- exact counts
- first/last dates
- hours totals
- category comparisons

Stats alone is not enough for:

- pattern learning
- struggle analysis
- semantic topic recall

The coach needs both.

---

## Phase 7.5: Understand Tool Calling Itself

Here are the key lines to conceptually understand in [src/app/api/chat/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/chat/route.ts):

- `toolChoice: "auto"`
- `stopWhen: stepCountIs(4)`
- `tools: { ... }`

### What `toolChoice: "auto"` means

The model is allowed to decide:

- answer directly
- call one tool
- call multiple tools
- reason across multiple steps

### What `stepCountIs(4)` means

The model cannot loop forever.

It gets a bounded number of reasoning/tool steps.
This protects latency and cost.

### What actually happens at runtime

1. model reads prompt + messages
2. model decides it needs a tool
3. model emits a structured tool call
4. your backend validates input with `zod`
5. `execute(...)` runs server logic
6. tool result is returned to the model
7. model writes the final answer using that evidence

That is tool calling in this implementation.

---

## Phase 7.6: Study the Retrieval Fallback Chain

In [src/lib/coach-context.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/coach-context.ts), read:

- `searchHistoricalLogs(...)`

This retrieval function does not rely on a single mechanism.

### The chain

1. Atlas vector search
2. app-side cosine similarity on stored embeddings
3. keyword/category fallback

### Why this is important

Production systems should degrade gracefully.

If vector search is unavailable or weak:

- the app should still answer
- it should not silently break

This is one of the strongest design patterns in the implementation.

---

## Phase 7.7: Learn Why Stats Need Their Own Logic

Open:

- `getCoachStats(...)` in [src/lib/coach-context.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/coach-context.ts)

This function is intentionally conservative.

### It returns things like

- matched logs
- matched hours
- first relevant date
- last relevant date
- active days
- category totals
- recent examples

### Important nuance

It uses “based on matching logs” semantics.

That means:

- it does not hallucinate exact solved counts
- it does not claim certainty that the logs do not prove

This is a very important product decision.
It makes the coach more trustworthy.

---

## Phase 7.8: Study the Streaming UI Layer

Now move to the frontend:

- [src/components/AIAssistantV2.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/AIAssistantV2.tsx)
- [src/components/ToolCallAccordion.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/ToolCallAccordion.tsx)
- [src/components/ChatMarkdown.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/ChatMarkdown.tsx)

### What happens here

The backend does not only stream text.
It also streams tool parts like:

- `tool-searchHistoricalLogs`
- `tool-getCoachStats`

`AIAssistantV2.tsx` parses those tool parts and turns them into structured `ToolCallData`.

`ToolCallAccordion.tsx` renders:

- loading state
- success/error state
- query details
- resolved categories
- advisory labels
- topic terms
- intent tags
- retrieval mode
- date coverage

`ChatMarkdown.tsx` renders the final answer text.

### The UX lesson

Tool calling becomes much more trustworthy when the user can see:

- what the model searched
- what kind of result it got
- whether the answer came from evidence or just baseline context

---

## Phase 7.9: Learn the Logging Strategy

Back in [src/app/api/chat/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/chat/route.ts), study the debug logs:

- `[AI_COACH_RAG_DEBUG]`
- `[AI_COACH_TOOL_CALL_START]`
- `[AI_COACH_TOOL_CALL_FINISH]`
- `[AI_COACH_TOOL_SUMMARY]`

### Why these logs matter

Without these, you cannot answer:

- Did the model use tools?
- Did it choose the right tool?
- What input did it send?
- Was retrieval vector or fallback?
- Did the answer rely on tools or baseline only?

These logs were critical for iterating on:

- DSA journey quality
- project progress quality
- learning-topic quality

This is how you make AI systems debuggable instead of mystical.

---

## Your Reading Order

Read in this order:

1. [src/app/api/chat/route.ts](/Users/saranshmittal/Desktop/DiscipLog/src/app/api/chat/route.ts)
2. [src/lib/coach-context.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/coach-context.ts)
3. [src/lib/coach-embeddings.ts](/Users/saranshmittal/Desktop/DiscipLog/src/lib/coach-embeddings.ts)
4. [src/components/AIAssistantV2.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/AIAssistantV2.tsx)
5. [src/components/ToolCallAccordion.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/ToolCallAccordion.tsx)
6. [src/components/ChatMarkdown.tsx](/Users/saranshmittal/Desktop/DiscipLog/src/components/ChatMarkdown.tsx)

---

## Solo Exercises

### Exercise 1: Trace one real query

Take:

- `Analyze my DSA journey so far`

Trace:

1. how `buildCoachQuerySignals(...)` classifies it
2. what tools the model chooses
3. what the tool outputs look like
4. how the final markdown answer uses that evidence

### Exercise 2: Compare baseline-only vs tool-assisted

Compare these prompts:

- `What should I focus on today?`
- `How has DiscipLog progressed so far?`

Observe:

- which one uses tools
- which one can answer from baseline context
- why the system behaves differently

### Exercise 3: Add one debug field mentally

Pretend you want to log:

- `matchStrategy`

Figure out:

1. where it is created
2. where it is serialized
3. where it appears in the accordion

If you can trace that cleanly, you understand the full data flow.

---

## What “Good Understanding” Looks Like

You’ve understood this phase when you can explain:

1. why the model should not query Mongo directly
2. why baseline context and tool context are separate
3. why `searchHistoricalLogs` and `getCoachStats` are different tools
4. why `toolChoice: "auto"` still needs strong server boundaries
5. why retrieval must degrade gracefully
6. how the frontend renders tool activity from streamed parts

If you can explain those six points in your own words, you understand the architecture well enough to extend it safely.
