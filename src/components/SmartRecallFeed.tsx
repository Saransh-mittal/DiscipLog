"use client";

import {
  Brain,
  CheckCircle2,
  Clock3,
  Lock,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmartRecall } from "@/components/SmartRecallProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";
import type { SmartRecallCardView } from "@/lib/smart-recall-types";

/* ────────────────────────────────────────────────────────
   Tiny helpers
   ──────────────────────────────────────────────────────── */

function formatReturnTime(dueAt: string | null): string {
  if (!dueAt) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dueAt));
}

/* ────────────────────────────────────────────────────────
   Single card row — compact, information-dense, no bloat
   ──────────────────────────────────────────────────────── */

type CardTone = "due" | "snoozed" | "completed";

function RecallCardRow({
  card,
  tone,
}: {
  card: SmartRecallCardView;
  tone: CardTone;
}) {
  const { theme } = useWorld();

  const isDue = tone === "due";
  const isCompleted = tone === "completed";

  return (
    <div
      className="recall-card-row group flex items-center gap-3 border-b px-4 py-3.5 transition-colors duration-150 last:border-b-0"
      style={{
        borderColor: "color-mix(in oklch, var(--world-accent) 8%, transparent)",
      }}
    >
      {/* Status indicator */}
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        {isDue ? (
          <span
            className="recall-status-dot inline-flex h-2 w-2 rounded-full"
            style={{
              background: theme.accent,
              boxShadow: `0 0 6px ${theme.accentGlow ?? theme.accent}`,
            }}
          />
        ) : tone === "snoozed" ? (
          <Clock3
            className="h-3.5 w-3.5"
            style={{ color: theme.textMuted }}
          />
        ) : (
          <CheckCircle2
            className="h-3.5 w-3.5"
            style={{ color: "color-mix(in oklch, var(--world-accent) 60%, var(--world-text-muted))" }}
          />
        )}
      </div>

      {/* Title — takes remaining space */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold leading-snug"
          style={{
            color: isCompleted ? theme.textMuted : theme.textPrimary,
            textDecoration: isCompleted ? "line-through" : "none",
            textDecorationColor: isCompleted
              ? "color-mix(in oklch, var(--world-text-muted) 50%, transparent)"
              : undefined,
          }}
        >
          {card.title}
        </p>
      </div>

      {/* Meta: either return time OR category+date */}
      <div className="shrink-0 text-right">
        {tone === "snoozed" && card.dueAt ? (
          <span
            className="text-xs tabular-nums"
            style={{ color: theme.textMuted }}
          >
            {formatReturnTime(card.dueAt)}
          </span>
        ) : (
          <span
            className="text-xs uppercase tracking-[0.1em]"
            style={{ color: theme.textMuted }}
          >
            {card.category}
            <span style={{ opacity: 0.4 }}> · </span>
            {card.sourceDate}
          </span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Loading skeleton — matches the new compact layout
   ──────────────────────────────────────────────────────── */

function RecallFeedSkeleton() {
  const { CardSkin, theme } = useWorld();
  const shimmerBg = "color-mix(in oklch, var(--world-accent) 6%, transparent)";
  const shimmerHi = "color-mix(in oklch, var(--world-accent) 12%, transparent)";

  return (
    <div className="recall-loading-skeleton space-y-4">
      {/* Header skeleton */}
      <CardSkin style={{ padding: "1rem 1.25rem" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="recall-skeleton-pulse h-7 w-16 rounded-lg"
              style={{ background: shimmerHi }}
            />
            <div
              className="recall-skeleton-pulse h-4 w-48 rounded-md"
              style={{ background: shimmerBg }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className="recall-skeleton-pulse h-9 w-28 rounded-full"
              style={{ background: shimmerBg }}
            />
            <div
              className="recall-skeleton-pulse h-9 w-9 rounded-full"
              style={{ background: shimmerBg }}
            />
          </div>
        </div>
      </CardSkin>

      {/* Card rows skeleton */}
      <CardSkin style={{ padding: 0 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0"
            style={{
              borderColor:
                "color-mix(in oklch, var(--world-accent) 6%, transparent)",
            }}
          >
            <div
              className="recall-skeleton-pulse h-2 w-2 shrink-0 rounded-full"
              style={{ background: shimmerHi, animationDelay: `${i * 80}ms` }}
            />
            <div className="flex-1 space-y-1">
              <div
                className="recall-skeleton-pulse h-4 rounded-md"
                style={{
                  background: shimmerBg,
                  width: `${65 - i * 6}%`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            </div>
            <div
              className="recall-skeleton-pulse h-3 w-20 shrink-0 rounded-md"
              style={{ background: shimmerBg, animationDelay: `${i * 80}ms` }}
            />
          </div>
        ))}
      </CardSkin>

      <div className="flex items-center justify-center gap-2 pt-1">
        <RefreshCw
          className="h-3.5 w-3.5 animate-spin"
          style={{ color: theme.accent }}
        />
        <span
          className="text-xs font-medium uppercase tracking-[0.14em]"
          style={{ color: theme.textMuted }}
        >
          Loading recall queue
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────────────────── */

export default function SmartRecallFeed() {
  const {
    summary,
    loading,
    error,
    startRecall,
  } = useSmartRecall();
  const { CardSkin, theme, tier } = useWorld();

  /* ── Full-page skeleton ── */
  if (loading) {
    return <RecallFeedSkeleton />;
  }

  const dueCards = summary?.queue.due ?? [];
  const snoozedCards = summary?.queue.snoozed ?? [];
  const completedCards = summary?.queue.completedToday ?? [];
  const totalCards = dueCards.length + snoozedCards.length + completedCards.length;

  const isLocked = summary?.state === "locked";
  const isReady = summary?.state === "ready";

  /* Build ordered flat list: due → snoozed → completed */
  const rows: Array<{ card: SmartRecallCardView; tone: CardTone }> = [
    ...dueCards.map((card) => ({ card, tone: "due" as const })),
    ...snoozedCards.map((card) => ({ card, tone: "snoozed" as const })),
    ...completedCards.map((card) => ({ card, tone: "completed" as const })),
  ];

  /* Stat string for the header */
  const statParts: string[] = [];
  if (dueCards.length > 0)
    statParts.push(`${dueCards.length} ready`);
  if (snoozedCards.length > 0)
    statParts.push(`${snoozedCards.length} snoozed`);
  if (completedCards.length > 0)
    statParts.push(`${completedCards.length} done today`);
  const statLine = statParts.length > 0 ? statParts.join(" · ") : "No cards yet";

  return (
    <div className="recall-feed-root space-y-4 v2-stagger-in v2-stagger-1">
      {/* ── Error banner ── */}
      {error && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "oklch(0.74 0.16 28 / 18%)",
            background: "oklch(0.74 0.16 28 / 8%)",
            color: "oklch(0.92 0.04 70)",
          }}
        >
          {error}
        </div>
      )}

      {/* ══════════════════════════════════════
         COMMAND CENTER — single header bar
         ══════════════════════════════════════ */}
      <CardSkin
        className="recall-cmd-bar"
        style={{
          padding: "0.875rem 1.25rem",
          background: isReady
            ? "linear-gradient(135deg, color-mix(in oklch, var(--world-accent) 6%, transparent), transparent 60%), var(--world-surface)"
            : undefined,
        }}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Left: title + stats */}
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <h1
              className="shrink-0 text-xl font-extrabold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.textPrimary,
              }}
            >
              Recall
            </h1>

            {!isLocked && (
              <span
                className="text-xs tabular-nums"
                style={{ color: theme.textMuted }}
              >
                {statLine}
              </span>
            )}

            {isLocked && (
              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: theme.textMuted }}
              >
                <Lock className="h-3 w-3" />
                {summary!.unlockProgress.currentLogs}/{summary!.unlockProgress.requiredLogs} logs to unlock
              </span>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex shrink-0 items-center gap-2">
            {!isLocked && (
              <Button
                onClick={startRecall}
                disabled={!isReady}
                className="recall-start-btn rounded-full px-5 text-sm font-semibold"
                style={{
                  background: theme.accent,
                  color:
                    tier === 4
                      ? "oklch(0.12 0.01 70)"
                      : "oklch(0.12 0.01 250)",
                }}
              >
                <Brain className="h-4 w-4" />
                Start Recall
              </Button>
            )}
          </div>
        </div>

        {/* Locked progress bar — inline within the header */}
        {isLocked && summary && (
          <div className="mt-3">
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{
                background:
                  "color-mix(in oklch, var(--world-accent) 10%, transparent)",
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (summary.unlockProgress.currentLogs / summary.unlockProgress.requiredLogs) * 100)}%`,
                  background: `linear-gradient(90deg, ${theme.accent}, color-mix(in oklch, ${theme.accent} 70%, white))`,
                }}
              />
            </div>
          </div>
        )}
      </CardSkin>

      {/* ══════════════════════════════════════
         CARD LIST — flat, sorted, compact
         ══════════════════════════════════════ */}
      {!isLocked && totalCards > 0 && (
        <CardSkin className="recall-card-list" style={{ padding: 0 }}>
          {/* Accent top line */}
          {isReady && (
            <div
              className="h-[2px] w-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                opacity: tier >= 3 ? 0.6 : tier >= 2 ? 0.45 : tier >= 1 ? 0.35 : 0.25,
              }}
            />
          )}

          {rows.map(({ card, tone }) => (
            <RecallCardRow key={card.id} card={card} tone={tone} />
          ))}
        </CardSkin>
      )}

      {/* ── Empty state — no cards at all ── */}
      {!isLocked && totalCards === 0 && (
        <div
          className="flex flex-col items-center gap-3 py-16 text-center"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{
              borderColor:
                "color-mix(in oklch, var(--world-accent) 16%, transparent)",
              background:
                "radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--world-accent) 10%, transparent), transparent 65%)",
              color: theme.textMuted,
            }}
          >
            <Zap className="h-5 w-5" />
          </div>
          <p
            className="max-w-xs text-sm leading-relaxed"
            style={{ color: theme.textMuted }}
          >
            No recall cards yet. Log more substantial work to generate your first cards.
          </p>
        </div>
      )}
    </div>
  );
}
