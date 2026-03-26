"use client";

import { useEffect, useMemo, useState } from "react";
import { MoonStar, Trophy, Zap } from "lucide-react";
import ChatMarkdown from "@/components/ChatMarkdown";
import { useLogs } from "@/components/LogsProvider";
import { getDateKeyInTimezone } from "@/lib/logs";

interface EndOfDayReviewResponse {
  dateKey: string;
  markdown: string;
  todayTotalHours: number;
  todayLogCount: number;
  fallbackUsed: boolean;
}

function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getLocalHour(timezone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );
}

export default function EndOfDayMicroReview() {
  const { logs, loading } = useLogs();
  const [review, setReview] = useState<EndOfDayReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezone = useMemo(getTimezone, []);
  const localHour = useMemo(() => getLocalHour(timezone), [timezone]);
  const todayDateKey = useMemo(() => getDateKeyInTimezone(timezone), [timezone]);
  const todayLogs = useMemo(
    () => logs.filter((log) => log.date === todayDateKey),
    [logs, todayDateKey]
  );
  const todayTotalHours = useMemo(
    () =>
      Math.round(
        todayLogs.reduce((sum, log) => sum + (Number(log.hours) || 0), 0) * 100
      ) / 100,
    [todayLogs]
  );
  const isUnlocked = localHour >= 18;
  const latestLogMarker = todayLogs[0]?._id ?? todayLogs[0]?.loggedAt ?? "none";

  useEffect(() => {
    if (!isUnlocked || todayLogs.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadReview() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/end-of-day-review?timezone=${encodeURIComponent(timezone)}`
        );
        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = (await res.json()) as EndOfDayReviewResponse;
        if (!cancelled) {
          setReview(data);
        }
      } catch {
        if (!cancelled) {
          setError("Could not forge tonight's review.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReview();

    return () => {
      cancelled = true;
    };
  }, [isUnlocked, latestLogMarker, timezone, todayLogs.length]);

  return (
    <section className="v2-stagger-in v2-stagger-5">
      <div
        className="world-card relative overflow-hidden border p-6 md:p-7"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in oklch, var(--world-accent) 10%, transparent), transparent 34%), radial-gradient(circle at bottom left, oklch(0.62 0.08 255 / 9%), transparent 32%), var(--world-surface, var(--v2-surface))",
        }}
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{
                borderColor: isUnlocked
                  ? "color-mix(in oklch, var(--world-accent) 22%, transparent)"
                  : "oklch(1 0 0 / 10%)",
                background: isUnlocked
                  ? "color-mix(in oklch, var(--world-accent) 12%, transparent)"
                  : "oklch(1 0 0 / 4%)",
                color: isUnlocked
                  ? "var(--world-accent)"
                  : "var(--world-text-muted, var(--v2-text-muted))",
              }}
            >
              <MoonStar className="h-3.5 w-3.5" />
              {isUnlocked ? "Night Review Unlocked" : "Night Review Unlocks at 18:00"}
            </div>

            <div>
              <h2
                className="text-2xl font-bold tracking-tight md:text-3xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                End-of-Day Micro Review
              </h2>
              <p
                className="mt-2 max-w-2xl text-sm leading-relaxed md:text-base"
                style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
              >
                A compact nightly debrief that turns today&apos;s logs into a sharper
                mental model for tomorrow.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div
              className="rounded-2xl border px-3 py-2 text-sm"
              style={{
                borderColor: "oklch(1 0 0 / 8%)",
                background: "oklch(1 0 0 / 3%)",
              }}
            >
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}
              >
                Today&apos;s XP
              </div>
              <div className="mt-1 font-semibold">{todayTotalHours}h</div>
            </div>
            <div
              className="rounded-2xl border px-3 py-2 text-sm"
              style={{
                borderColor: "oklch(1 0 0 / 8%)",
                background: "oklch(1 0 0 / 3%)",
              }}
            >
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}
              >
                Runs Logged
              </div>
              <div className="mt-1 font-semibold">{todayLogs.length}</div>
            </div>
          </div>
        </div>

        {!isUnlocked && (
          <div
            className="rounded-3xl border px-5 py-5"
            style={{
              borderColor: "oklch(1 0 0 / 8%)",
              background:
                "linear-gradient(135deg, oklch(1 0 0 / 3%), transparent)",
            }}
          >
            <div className="flex items-start gap-3">
              <Zap
                className="mt-0.5 h-5 w-5"
                style={{ color: "var(--world-accent, var(--v2-amber-400))" }}
              />
              <div>
                <p className="font-semibold">Tonight&apos;s review is still charging.</p>
                <p
                  className="mt-1 text-sm leading-relaxed"
                  style={{
                    color: "var(--world-text-secondary, var(--v2-text-secondary))",
                  }}
                >
                  Once it is evening in your local time, DiscipLog will turn
                  today&apos;s logs into a compact XP recap, boss fight, mental
                  model, and tomorrow spawn point.
                </p>
              </div>
            </div>
          </div>
        )}

        {isUnlocked && !loading && todayLogs.length === 0 && (
          <div
            className="rounded-3xl border px-5 py-5"
            style={{
              borderColor: "oklch(1 0 0 / 8%)",
              background:
                "linear-gradient(135deg, oklch(1 0 0 / 3%), transparent)",
            }}
          >
            <div className="flex items-start gap-3">
              <Trophy
                className="mt-0.5 h-5 w-5"
                style={{ color: "var(--world-accent, var(--v2-amber-400))" }}
              />
              <div>
                <p className="font-semibold">No run logged today.</p>
                <p
                  className="mt-1 text-sm leading-relaxed"
                  style={{
                    color: "var(--world-text-secondary, var(--v2-text-secondary))",
                  }}
                >
                The nightly review becomes more useful after even one real
                focus block. Log a session and this card will turn the day into
                a sharper mental model.
                </p>
              </div>
            </div>
          </div>
        )}

        {isUnlocked && todayLogs.length > 0 && (
          <div
            className="rounded-[28px] border p-5 md:p-6"
            style={{
              borderColor: "oklch(1 0 0 / 8%)",
              background:
                "linear-gradient(180deg, oklch(0.14 0.008 250 / 96%), oklch(0.11 0.006 250 / 98%))",
              boxShadow: "inset 0 1px 0 oklch(1 0 0 / 4%)",
            }}
          >
            {isLoading && (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-32 rounded bg-[oklch(1_0_0_/_8%)]" />
                <div className="h-4 w-full rounded bg-[oklch(1_0_0_/_6%)]" />
                <div className="h-4 w-5/6 rounded bg-[oklch(1_0_0_/_5%)]" />
                <div className="h-4 w-2/3 rounded bg-[oklch(1_0_0_/_5%)]" />
              </div>
            )}

            {!isLoading && error && (
              <p style={{ color: "oklch(0.92 0.04 70)" }}>{error}</p>
            )}

            {!isLoading && !error && review && (
              <div className="dcl-md-root text-sm leading-relaxed">
                <ChatMarkdown content={review.markdown} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
