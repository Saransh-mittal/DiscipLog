# Phase 6: Next Steps for Refactoring

## Your Solo Refactoring Task: Fix the Global Mongoose Cache Type

**Objective:** Remove the `(global as any)` type escape hatch from `src/lib/mongoose.ts` and replace it with proper TypeScript global type augmentation.

**Why this task specifically:**
- It's a *contained*, *isolated* change — one file, no UI impact, no behavior change
- It teaches the subtle concept of **ambient module augmentation** (`declare global`)
- It forces you to understand the Node.js `global` object vs browser `window`
- It's a real production issue present in thousands of AI-generated Next.js codebases

**Scope:** Only touch `src/lib/mongoose.ts` (and optionally create a `src/types/global.d.ts` file)

---

## Step-by-Step Guide (Understand, Don't Copy)

**Step 1: Understand the current problem**

Open `src/lib/mongoose.ts`. On line 5, read `(global as any).mongoose`. Ask yourself: "What shape does this object need to be?" Look at lines 7–8 to find the answer: it needs `{ conn: ..., promise: ... }`.

**Step 2: Create the type declaration file**

Create a new file: `src/types/global.d.ts`

Inside it, write a `declare global` block that adds a `mongoose` property to the `NodeJS.Global` interface (or simply to `var` in the global scope). The shape should have `conn` and `promise` with appropriate types.

> 💡 Hint: `mongoose.connect()` is an async function. Its return type can be found with `ReturnType<typeof mongoose.connect>`. The stored connection is `Awaited<ReturnType<typeof mongoose.connect>>`.

**Step 3: Update `mongoose.ts`**

Replace:
```typescript
let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}
```

With code that uses `globalThis.mongoose` and your new types. The behavior must remain identical — only the types change.

**Step 4: Verify**

Run `npx tsc --noEmit` in the terminal. If it passes with zero errors, you've done it correctly. Bonus: hover over `cached.conn` in your editor — you should now see a real type instead of `any`.

---

## What Success Looks Like

- `mongoose.ts` has zero `any` casts
- `global.d.ts` is a new file with a clean `declare global` block
- `npx tsc --noEmit` exits with no errors
- Hovering over `cached.conn` in VS Code shows a meaningful type, not `any`

---

## Stretch Goal (if you finish fast)

After completing the Mongoose fix, try the second anti-pattern from Phase 1:
**Replace the local `LogEntry` interface in `route.ts` with an import of `DashboardLog` from `@/lib/logs`.**

This means:
1. Delete lines 35–43 of `route.ts` (the local `interface LogEntry`)
2. Add `import type { DashboardLog } from "@/lib/logs";` at the top
3. Change `buildSystemPrompt`'s signature to use `DashboardLog[]` instead of `LogEntry[]`
4. Run `npx tsc --noEmit` — if there are new errors, they reveal real mismatches between the two types that you should resolve

This teaches you the *cost of duplication*: the compiler will show you exactly where the two interfaces disagreed.
