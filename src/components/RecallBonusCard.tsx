"use client";

import { Brain, CheckCircle2, Clock3, Flame, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveTab } from "@/components/DashboardNav";
import { useSmartRecall } from "@/components/SmartRecallProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";

function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatNextDueAt(dateString: string | null, timezone: string): string {
  if (!dateString) {
    return "No pending recall";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export default function RecallBonusCard() {
  const { summary, loading, error, startRecall, openTutorial } = useSmartRecall();
  const { CardSkin, theme, tier } = useWorld();
  const { setTab } = useActiveTab();
  const timezone = getTimezone();

  const state = summary?.state ?? "locked";

  const statusCopy =
    state === "ready"
      ? {
          icon: Brain,
          eyebrow: `${summary?.dueCount ?? 0} ready now`,
          title: "Recall bonus is live",
          body:
            (summary?.pendingCount ?? 0) > 1
              ? `${summary?.pendingCount} cards are waiting, but the flow stays one at a time.`
              : "A fresh recall card is ready to sharpen the next block.",
          primaryLabel: "Start Recall",
          primaryAction: () => startRecall(),
          secondaryLabel: "What is this?",
          secondaryAction: () => openTutorial(),
        }
      : state === "scheduled"
        ? {
            icon: Clock3,
            eyebrow: "Coming back soon",
            title: `Next recall at ${formatNextDueAt(summary?.nextDueAt ?? null, timezone)}`,
            body: "You cleared what was ready. The next card will return automatically when its timer expires.",
            primaryLabel: "Open Recall Tab",
            primaryAction: () => setTab("recall"),
            secondaryLabel: "What is this?",
            secondaryAction: () => openTutorial(),
          }
        : state === "cleared"
          ? {
              icon: CheckCircle2,
              eyebrow: "All covered",
              title: "Nothing left to recall right now",
              body: "Your current recall queue is finished. Log more substantial work to forge the next set of cards.",
              primaryLabel: "Go To Log",
              primaryAction: () => setTab("log"),
              secondaryLabel: "Open Recall Tab",
              secondaryAction: () => setTab("recall"),
            }
          : {
              icon: Lock,
              eyebrow: `${summary?.unlockProgress.currentLogs ?? 0}/${summary?.unlockProgress.requiredLogs ?? 3} logs`,
              title: "Smart Recall is locked",
              body: `Log ${summary?.logsUntilUnlock ?? 3} more ${summary?.logsUntilUnlock === 1 ? "session" : "sessions"} to unlock meaningful recall cards.`,
              primaryLabel: "Go To Log",
              primaryAction: () => setTab("log"),
              secondaryLabel: "What is this?",
              secondaryAction: () => openTutorial(),
            };

  const Icon = statusCopy.icon;

  // Tier-aware accent line opacity
  const accentLineOpacity = tier >= 3 ? 0.7 : tier >= 2 ? 0.55 : tier >= 1 ? 0.4 : 0.3;

  return (
    <CardSkin
      className="recall-bonus-card relative overflow-hidden"
      style={{
        padding: 0,
        background:
          `radial-gradient(circle at top right, color-mix(in oklch, ${theme.accent} 12%, transparent), transparent 42%), ${theme.surface}`,
      }}
    >
      {/* Premium thin accent line — synced with world accent */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
          opacity: accentLineOpacity,
        }}
      />

      {/* Card content with padding */}
      <div style={{ padding: theme.spacing }}>
        {/* Horizontal layout */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {/* Left: icon + text */}
          <div className="flex items-start gap-4 sm:items-center">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center border"
              style={{
                borderColor: `color-mix(in oklch, ${theme.accent} 22%, transparent)`,
                color: theme.accent,
                borderRadius: theme.borderRadius,
                background:
                  `radial-gradient(circle at 30% 20%, color-mix(in oklch, ${theme.accent} 14%, transparent), transparent 65%)`,
              }}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    borderColor: `color-mix(in oklch, ${theme.accent} 18%, transparent)`,
                    color: theme.accent,
                    background:
                      `linear-gradient(135deg, color-mix(in oklch, ${theme.accent} 10%, transparent), transparent)`,
                  }}
                >
                  <Flame className="h-3 w-3" />
                  Recall Bonus
                </div>
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: theme.textMuted }}
                >
                  {loading ? "Loading" : statusCopy.eyebrow}
                </span>
              </div>

              <h3
                className="mt-1.5 text-lg font-bold tracking-tight sm:text-xl"
                style={{ fontFamily: "var(--font-display)", color: theme.textPrimary }}
              >
                {loading ? "Forging recall..." : statusCopy.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: theme.textSecondary }}>
                {error ?? (loading ? "Checking your recall queue." : statusCopy.body)}
              </p>
            </div>
          </div>

          {/* Right: CTA buttons */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button
              onClick={statusCopy.primaryAction}
              disabled={loading}
              className="rounded-full px-5"
              style={{
                background: theme.accent,
                color: tier === 4 ? "oklch(0.12 0.01 70)" : "oklch(0.12 0.01 250)",
              }}
            >
              {statusCopy.primaryLabel}
            </Button>

            <Button
              onClick={statusCopy.secondaryAction}
              disabled={loading}
              variant="outline"
              className="rounded-full"
              style={{
                borderColor: `color-mix(in oklch, ${theme.accent} 18%, transparent)`,
                color: theme.textSecondary,
                background: "transparent",
              }}
            >
              <Sparkles className="h-4 w-4" />
              {statusCopy.secondaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </CardSkin>
  );
}
