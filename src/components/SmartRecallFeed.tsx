"use client";

import {
  Brain,
  CheckCircle2,
  Clock3,
  Flame,
  Lock,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSmartRecall } from "@/components/SmartRecallProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";
import type { SmartRecallCardView } from "@/lib/smart-recall-types";

function EmptyQueuePlaceholder({ message, icon: Icon }: { message: string; icon: typeof Brain }) {
  const { theme } = useWorld();

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border px-5 py-8 text-center"
      style={{
        borderColor: "color-mix(in oklch, var(--world-accent) 10%, transparent)",
        background: "color-mix(in oklch, var(--world-surface-raised) 60%, transparent)",
      }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-2xl"
        style={{
          background: "color-mix(in oklch, var(--world-accent) 8%, transparent)",
          color: theme.textMuted,
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="max-w-xs text-sm leading-relaxed" style={{ color: theme.textMuted }}>
        {message}
      </p>
    </div>
  );
}

function RecallCardItem({
  card,
  tone,
}: {
  card: SmartRecallCardView;
  tone: "ready" | "scheduled" | "completed";
}) {
  const { theme } = useWorld();

  const isReady = tone === "ready";
  const isCompleted = tone === "completed";

  return (
    <div
      className="recall-card-item group rounded-2xl border px-4 py-4 transition-all duration-200"
      style={{
        borderColor: isReady
          ? "color-mix(in oklch, var(--world-accent) 22%, transparent)"
          : "color-mix(in oklch, var(--world-accent) 10%, transparent)",
        background: isReady
          ? "linear-gradient(135deg, color-mix(in oklch, var(--world-accent) 8%, transparent), transparent)"
          : "color-mix(in oklch, var(--world-surface-raised) 70%, transparent)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
              {card.title}
            </p>
            {isReady && (
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: theme.accent }}
              />
            )}
          </div>
          <p
            className="mt-1.5 text-xs uppercase tracking-[0.16em]"
            style={{ color: theme.textMuted }}
          >
            {card.category} • {card.sourceDate}
          </p>
        </div>
        {isCompleted && (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} />
        )}
      </div>
      <p
        className="mt-3 text-sm leading-relaxed"
        style={{ color: theme.textSecondary }}
      >
        {card.prompt}
      </p>
      {tone === "scheduled" && card.dueAt && (
        <p
          className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em]"
          style={{ color: theme.textMuted }}
        >
          <Clock3 className="h-3 w-3" />
          Returns at{" "}
          {new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(card.dueAt))}
        </p>
      )}
    </div>
  );
}

export default function SmartRecallFeed() {
  const { summary, loading, refreshing, error, refresh, startRecall, openTutorial } =
    useSmartRecall();
  const { CardSkin, theme, tier } = useWorld();

  const queueSections: Array<{
    title: string;
    empty: string;
    icon: typeof Brain;
    cards: SmartRecallCardView[];
    tone: "ready" | "scheduled" | "completed";
  }> = [
    {
      title: "Ready Now",
      empty: "No card is ready right this second.",
      icon: Zap,
      cards: summary?.queue.due ?? [],
      tone: "ready",
    },
    {
      title: "Coming Back",
      empty: "Nothing is currently snoozed.",
      icon: Clock3,
      cards: summary?.queue.snoozed ?? [],
      tone: "scheduled",
    },
    {
      title: "Completed Today",
      empty: "You haven't cleared a recall card today yet.",
      icon: CheckCircle2,
      cards: summary?.queue.completedToday ?? [],
      tone: "completed",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Hero Section ── */}
      <section className="v2-stagger-in v2-stagger-1">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          {/* Left side: title + description */}
          <div className="space-y-4">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{
                borderColor: "color-mix(in oklch, var(--world-accent) 20%, transparent)",
                background:
                  "linear-gradient(135deg, color-mix(in oklch, var(--world-accent) 10%, transparent), transparent)",
                color: theme.accent,
              }}
            >
              <Flame className="h-3.5 w-3.5" />
              Smart Recall
            </div>

            <div>
              <h1
                className="text-3xl font-extrabold tracking-tighter md:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Recall Queue
              </h1>
              <p
                className="mt-2 max-w-lg text-sm leading-relaxed md:text-base"
                style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
              >
                Only your substantial logs turn into one-card-at-a-time review. Keep what matters,
                drop what doesn&apos;t.
              </p>
            </div>
          </div>

          {/* Right side: action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={startRecall}
              disabled={loading || summary?.state !== "ready"}
              className="rounded-full px-5"
              style={{
                background: theme.accent,
                color: tier === 4 ? "oklch(0.12 0.01 70)" : "oklch(0.12 0.01 250)",
              }}
            >
              <Brain className="h-4 w-4" />
              Start Recall
            </Button>

            <Button
              onClick={openTutorial}
              variant="outline"
              className="rounded-full"
              style={{
                borderColor: "color-mix(in oklch, var(--world-accent) 18%, transparent)",
                color: theme.textSecondary,
                background: "transparent",
              }}
            >
              <Sparkles className="h-4 w-4" />
              How it works
            </Button>

            <Button
              onClick={() => {
                void refresh();
              }}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              style={{
                borderColor: "color-mix(in oklch, var(--world-accent) 18%, transparent)",
                color: theme.textSecondary,
                background: "transparent",
              }}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Status bar */}
        <CardSkin
          className="mt-5"
          style={{
            padding: "0.75rem 1.25rem",
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--world-accent) 6%, transparent), transparent 60%), var(--world-surface)",
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: "color-mix(in oklch, var(--world-accent) 14%, transparent)",
                color: theme.accent,
              }}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Loading
                </>
              ) : summary?.state === "locked" ? (
                <>
                  <Lock className="h-3 w-3" />
                  Locked
                </>
              ) : summary?.state === "ready" ? (
                <>
                  <Zap className="h-3 w-3" />
                  Ready
                </>
              ) : summary?.state === "scheduled" ? (
                <>
                  <Clock3 className="h-3 w-3" />
                  Scheduled
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Cleared
                </>
              )}
            </span>
            <span className="text-xs" style={{ color: theme.textMuted }}>
              {loading
                ? "Checking your recall queue"
                : summary?.state === "locked"
                  ? `Unlocks after ${summary.unlockProgress.requiredLogs} logs`
                  : `${summary?.pendingCount ?? 0} pending · ${summary?.completedTodayCount ?? 0} completed today`}
            </span>
          </div>
        </CardSkin>
      </section>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-2xl border px-5 py-4 text-sm"
          style={{
            borderColor: "oklch(0.74 0.16 28 / 18%)",
            background: "oklch(0.74 0.16 28 / 8%)",
            color: "oklch(0.92 0.04 70)",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Locked State ── */}
      {!loading && summary?.state === "locked" && (
        <CardSkin className="relative overflow-hidden text-center" style={{ padding: 0 }}>
          <div
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
              opacity: tier >= 3 ? 0.7 : tier >= 2 ? 0.5 : tier >= 1 ? 0.4 : 0.3,
            }}
          />
          <div className="p-8 md:p-12">
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border"
              style={{
                borderColor: "color-mix(in oklch, var(--world-accent) 24%, transparent)",
                color: theme.accent,
                background:
                  "radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--world-accent) 12%, transparent), transparent 65%)",
              }}
            >
              <Lock className="h-9 w-9" />
            </div>
            <h3
              className="mt-6 text-2xl font-bold tracking-tight md:text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Smart Recall unlocks after 3 real logs
            </h3>
            <p
              className="mx-auto mt-4 max-w-xl text-sm leading-relaxed md:text-base"
              style={{ color: theme.textSecondary }}
            >
              You are at {summary.unlockProgress.currentLogs}/
              {summary.unlockProgress.requiredLogs}. Log more real work so recall cards can be
              grounded in something worth revisiting.
            </p>

            {/* Progress bar */}
            <div
              className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full"
              style={{ background: "color-mix(in oklch, var(--world-accent) 10%, transparent)" }}
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
        </CardSkin>
      )}

      {/* ── Queue Sections ── */}
      {!loading && summary?.state !== "locked" && (
        <section className="grid gap-5 xl:grid-cols-3">
          {queueSections.map((section, index) => {
            const SectionIcon = section.icon;

            return (
              <CardSkin
                key={section.title}
                className={`recall-queue-section space-y-4 v2-stagger-in v2-stagger-${index + 1}`}
                style={{
                  background:
                    section.tone === "ready" && section.cards.length > 0
                      ? "linear-gradient(180deg, color-mix(in oklch, var(--world-accent) 6%, transparent), transparent 40%), var(--world-surface)"
                      : undefined,
                }}
              >
                {/* Section header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                      style={{
                        borderColor: "color-mix(in oklch, var(--world-accent) 18%, transparent)",
                        color: theme.accent,
                        background:
                          "radial-gradient(circle at 30% 20%, color-mix(in oklch, var(--world-accent) 12%, transparent), transparent 65%)",
                      }}
                    >
                      <SectionIcon className="h-4 w-4" />
                    </div>

                    <div>
                      <h3
                        className="text-lg font-bold tracking-tight"
                        style={{
                          fontFamily: "var(--font-display)",
                          color: theme.textPrimary,
                        }}
                      >
                        {section.title}
                      </h3>
                      <p
                        className="text-xs uppercase tracking-[0.16em]"
                        style={{ color: theme.textMuted }}
                      >
                        {section.cards.length} {section.cards.length === 1 ? "card" : "cards"}
                      </p>
                    </div>
                  </div>

                  {/* Accent dot for ready section w/ cards */}
                  {section.tone === "ready" && section.cards.length > 0 && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: theme.accent,
                        boxShadow: `0 0 8px ${theme.accentGlow ?? theme.accent}`,
                      }}
                    />
                  )}
                </div>

                {/* Cards list */}
                <div className="space-y-2.5">
                  {section.cards.length === 0 && (
                    <EmptyQueuePlaceholder
                      message={section.empty}
                      icon={section.icon}
                    />
                  )}

                  {section.cards.map((card) => (
                    <RecallCardItem key={card.id} card={card} tone={section.tone} />
                  ))}
                </div>
              </CardSkin>
            );
          })}
        </section>
      )}
    </div>
  );
}
