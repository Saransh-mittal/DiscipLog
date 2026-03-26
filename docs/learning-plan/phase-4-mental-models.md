# Phase 4: Mental Models for Recall

## Mental Model 1: The Chat Route is an Assembly Line with a Delayed Inspector

**Visualize this:**

Think of the `/api/chat` route as a factory assembly line:

```
[Raw materials arrive]  → user's messages + logs + timezone
        ↓
[Station 1: Security]   → getServerSession() check — reject unauthorized
        ↓
[Station 2: Context]    → buildSystemPrompt() — pulls DB data, assembles a rich briefing doc
        ↓
[Station 3: Machine]    → streamText() — sends briefing to OpenAI, gets a stream back
        ↓
[Conveyor belt to user] → chunks flow token-by-token via SSE (smoothStream makes it feel like water)
        ↓
[Delayed inspector]     → AFTER the belt finishes, queueMicrotask fires the Memory Evaluator
                           This inspector doesn't slow the belt down — it works in the background
```

**Key insight to recall:** The inspector (memory evaluator) is *not on the belt*. The user gets their answer whether or not the inspector does anything. This is why your UI feels snappy even though there's an extra AI call happening in the background.

---

## Mental Model 2: Implicit Memory is a "Coach's Notebook"

**Visualize this:**

Imagine a sports coach who watches every game (your work sessions). After enough games, the coach jots 2-4 sentences in a private notebook: *"This player works best in short bursts in the evening. Struggles with deep work on Monday mornings."*

That notebook is `implicitMemory` — a string field inside MongoDB.

The coach doesn't update the notebook after every single play. They wait until they have enough evidence (3+ new logs) and enough time has passed (1-hour cooldown). Then they re-evaluate: "has my understanding of this player *changed* meaningfully?" If yes → update notebook. If no → leave it alone.

```
Work log added
    ↓
cooldown expired? [NO] → stop. 
    ↓ [YES]
enough new evidence? [NO] → stop.
    ↓ [YES]
"Claim" the notebook (atomic lock = prevent double-write)
    ↓
Read last 14 days of logs → ask AI: "has the pattern changed?"
    ↓
AI returns: { action: "refresh_memory", memory: "new 3-sentence profile" }
    ↓
Write new notebook entry → clear lock
```

**Key insight to recall:** The memory isn't what you said in the chat. It's the *pattern* the AI infers about *you* over time. It's like a slowly-updated character sheet, not a transcript.

---

## Mental Model 3: `as const` + `[number]` Creates a "Type Vending Machine"

**Visualize this:**

Imagine a vending machine with labeled buttons. In plain JavaScript, you just have an unlabeled array `["drill_sergeant", "mentor", ...]`. TypeScript can't stop someone from pressing a button that doesn't exist.

`as const` locks the machine's button labels. `(typeof AI_PERSONAS)[number]` is the act of reading all the labels and creating a type that only allows those exact labels.

```
as const:
  ["drill_sergeant", "mentor", "analyst", "hype_man"]
  is now FROZEN. TypeScript knows every slot.

(typeof AI_PERSONAS)[number]:
  "If I index into this frozen array with any number index,
   what could I possibly get?"
  → "drill_sergeant" | "mentor" | "analyst" | "hype_man"
```

**Key insight to recall:** This pattern means your DB schema `enum`, your TypeScript type, and your runtime constants are all derived from a single declaration. Changing the vending machine (the array) automatically updates the labels everywhere.

---

## Mental Model 4: `getStoredAIProfile()` is a Border Control Agent

**Visualize this:**

Data from MongoDB via `.lean()` enters your TypeScript code with no passport — it's `unknown`. You cannot trust it.

`getStoredAIProfile(input: unknown)` is the border control agent who:
1. Checks the traveler's ID (is it an object? does `persona` match allowed values?)
2. Issues a new document if the original is dubious (`sanitizeProfileText`, `parseDate`)
3. Returns someone with a fully stamped passport: `StoredAIProfile`

If data comes in with a corrupted `implicitMemoryUpdatedAt` timestamp, the agent issues `null` — a safe fallback — instead of crashing the application.

```
MongoDB document (raw, untrusted)
         ↓
getStoredAIProfile(input: unknown)
         ↓
Each field runs through a validator/sanitizer
         ↓
Returns StoredAIProfile (fully typed, safe to use)
```

**Key insight to recall:** Every field in the returned object has been *actively verified*, not just assumed. The function can never return a malformed profile — TypeScript and runtime logic agree. This pattern is called "Parse, Don't Validate" and it's a cornerstone of robust backend code.
