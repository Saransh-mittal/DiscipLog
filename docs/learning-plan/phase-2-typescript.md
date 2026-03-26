# Phase 2: TypeScript & Type-Safety Deep Dive

## Pattern 1: `as const` + Indexed Type Derivation

**Where:** `src/lib/ai-profile.ts` lines 1–8 and `src/lib/logs.ts` lines 1–19

```typescript
// ai-profile.ts
export const AI_PERSONAS = [
  "drill_sergeant",
  "mentor",
  "analyst",
  "hype_man",
] as const;

export type AIPersona = (typeof AI_PERSONAS)[number];
//                       ^-- ReturnType trick
```

**What's happening step by step:**
1. `as const` makes the array `readonly ["drill_sergeant", "mentor", "analyst", "hype_man"]` — a *tuple* of string literals, not just `string[]`
2. `(typeof AI_PERSONAS)[number]` uses TypeScript's *indexed access* to extract the union: `"drill_sergeant" | "mentor" | "analyst" | "hype_man"`
3. `AIPersona` is now a **constrained string type** — not just any string

**Why this prevents production bugs:**
- Without this, `persona: "dril_sargent"` (typo) would only fail at runtime when the DB rejects it / the AI gets a wrong persona prompt. With this type, TypeScript throws a compile error immediately.
- The `AI_PERSONAS` array is the *single source of truth* — used in the Mongoose schema `enum: AI_PERSONAS` and as the TypeScript type simultaneously. Change one place, everything stays in sync.

---

## Pattern 2: Discriminated Union Result Type (Parse, don't validate)

**Where:** `src/lib/ai-profile.ts` lines 118–145

```typescript
export function parseExplicitAIProfile(
  input: unknown,
  options: { requirePersona?: boolean } = {}
):
  | { ok: true; value: ExplicitAIProfile }
  | { ok: false; error: string } {
  // ...
}
```

**What's happening:**
This is a **discriminated union** return type. The discriminant is the `ok` field. The branches are:
- `{ ok: true; value: ExplicitAIProfile }` — success path, has `value`
- `{ ok: false; error: string }` — failure path, has `error`

TypeScript's **type narrowing** means that after `if (result.ok)`, inside the `if` block, TypeScript *knows* `result.value` exists. Outside, it knows only `result.error` exists. You can never accidentally access `result.value` on a failure — it's a compile error.

**Why this prevents production bugs:**
- The traditional alternative is `throw` on failure. But throwing forces callers to use `try/catch`, which is easy to forget, especially in AI-assisted code.
- With this pattern, the caller is *forced* to handle both paths. The type system makes ignoring errors impossible. This is the Railway-Oriented Programming pattern — widely used in Rust (`Result<T, E>`) and now increasingly in TypeScript.

---

## Pattern 3: `ReturnType<>` as a Forward Reference

**Where:** `src/lib/implicit-memory.ts` line 112

```typescript
function getLastReviewAt(profile: ReturnType<typeof getStoredAIProfile>): Date | null {
```

**What's happening:**
Instead of importing and rewriting `StoredAIProfile`, the function declares its parameter type as `ReturnType<typeof getStoredAIProfile>` — literally "whatever `getStoredAIProfile` returns."

This is a **structural forward reference**. The benefit: if `getStoredAIProfile`'s return type changes, this function's expected parameter type automatically updates at compile time — with zero manual maintenance.

**Why this prevents production bugs:**
- If `StoredAIProfile` adds a new required field, and `getStoredAIProfile` is updated to produce it, then `getLastReviewAt` will immediately flag a type error if it uses the new field incorrectly — without you having to remember to update the signature separately.
- This is especially powerful in AI-assisted codebases where multiple functions are generated independently and can easily diverge.

---

## Missing Type Safety: The `(global as any)` Problem

**Where:** `src/lib/mongoose.ts` lines 5–9

```typescript
let cached = (global as any).mongoose;
```

The `as any` cast is a **type escape hatch** — it tells TypeScript "trust me, I know what this is." But TypeScript cannot verify that `cached` is the shape you expect. This is a dead zone in your type system.

**The production risk:** If `global.mongoose` is somehow `undefined` when the module restarts (which happens in serverless cold starts), `cached.conn` access throws a `TypeError: Cannot read properties of undefined` — a crash that TypeScript could have caught if typed properly.

**What missing safety looks like:** No IntelliSense on `cached.conn` or `cached.promise`. A typo like `cached.connection` silently returns `undefined` instead of causing a compile error.

**The fix:**
```typescript
declare global {
  var mongoose: {
    conn: Awaited<ReturnType<typeof import('mongoose').connect>> | null;
    promise: ReturnType<typeof import('mongoose').connect> | null;
  } | undefined;
}
```
This tells TypeScript the exact shape of the global and lets you safely access it.
