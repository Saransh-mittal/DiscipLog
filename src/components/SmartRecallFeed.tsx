"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";

type RecallRarity = "spark" | "forge" | "boss";

interface RecallCardData {
  title: string;
  prompt: string;
  answer: string;
  why: string;
  category: string;
  sourceDate: string;
  rarity: RecallRarity;
}

interface RecallFeedResponse {
  dateKey: string;
  cards: RecallCardData[];
  fallbackUsed: boolean;
}

const RARITY_META: Record<
  RecallRarity,
  {
    label: string;
    icon: typeof Sparkles;
    glow: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  spark: {
    label: "Spark",
    icon: Sparkles,
    glow: "oklch(0.78 0.14 70 / 12%)",
    border: "oklch(0.78 0.14 70 / 18%)",
    badgeBg: "oklch(0.78 0.14 70 / 14%)",
    badgeText: "oklch(0.94 0.04 80)",
  },
  forge: {
    label: "Forge",
    icon: Shield,
    glow: "oklch(0.68 0.16 45 / 12%)",
    border: "oklch(0.68 0.16 45 / 18%)",
    badgeBg: "oklch(0.68 0.16 45 / 14%)",
    badgeText: "oklch(0.92 0.04 70)",
  },
  boss: {
    label: "Boss",
    icon: Swords,
    glow: "oklch(0.74 0.16 28 / 14%)",
    border: "oklch(0.74 0.16 28 / 22%)",
    badgeBg: "oklch(0.74 0.16 28 / 16%)",
    badgeText: "oklch(0.97 0.04 60)",
  },
};

function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export default function SmartRecallFeed() {
  const [feed, setFeed] = useState<RecallFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<string[]>([]);

  const timezone = useMemo(getTimezone, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/recall?timezone=${encodeURIComponent(timezone)}`
        );
        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = (await res.json()) as RecallFeedResponse;
        if (!cancelled) {
          setFeed(data);
          setRevealedKeys([]);
        }
      } catch {
        if (!cancelled) {
          setError("Could not forge today's recall deck.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [timezone]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/recall?timezone=${encodeURIComponent(timezone)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = (await res.json()) as RecallFeedResponse;
      setFeed(data);
      setRevealedKeys([]);
    } catch {
      setError("Could not refresh today's recall deck.");
    } finally {
      setLoading(false);
    }
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  return (
    <div className="space-y-8">
      <section className="v2-stagger-in v2-stagger-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{
                borderColor: "color-mix(in oklch, var(--world-accent) 20%, transparent)",
                background:
                  "linear-gradient(135deg, color-mix(in oklch, var(--world-accent) 10%, transparent), transparent)",
                color: "var(--world-accent)",
              }}
            >
              <Flame className="h-3.5 w-3.5" />
              Daily Recall Deck
            </div>

            <div>
              <h1
                className="text-3xl font-extrabold tracking-tighter md:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Smart Recall
              </h1>
              <p
                className="mt-2 max-w-2xl text-sm leading-relaxed md:text-base"
                style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
              >
                A small daily deck pulled from your real logs so yesterday&apos;s
                effort becomes tomorrow&apos;s edge.
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50"
            style={{
              borderColor: "var(--world-border-strong, var(--v2-border-strong))",
              background:
                "linear-gradient(135deg, oklch(0.18 0.01 250 / 96%), oklch(0.14 0.01 250 / 96%))",
            }}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              style={{ color: "var(--world-accent, var(--v2-amber-400))" }}
            />
            Refresh Deck
          </button>
        </div>

        <div
          className="world-card relative overflow-hidden border px-5 py-4"
          style={{
            background:
              "radial-gradient(circle at top right, color-mix(in oklch, var(--world-accent) 10%, transparent), transparent 36%), var(--world-surface, var(--v2-surface))",
          }}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span
              className="rounded-full px-3 py-1 font-semibold uppercase tracking-[0.18em]"
              style={{
                background: "color-mix(in oklch, var(--world-accent) 12%, transparent)",
                color: "var(--world-accent)",
              }}
            >
              {feed?.dateKey || "Forging today&apos;s deck"}
            </span>
            <span style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>
              {feed?.cards.length ?? 0} cards drawn from recent work
            </span>
          </div>
        </div>
      </section>

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

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="world-card animate-pulse border p-5"
              style={{
                background:
                  "linear-gradient(180deg, oklch(1 0 0 / 2%), transparent), var(--world-surface, var(--v2-surface))",
              }}
            >
              <div className="mb-4 h-5 w-28 rounded-full bg-[oklch(1_0_0_/_8%)]" />
              <div className="mb-3 h-7 w-3/4 rounded-xl bg-[oklch(1_0_0_/_7%)]" />
              <div className="mb-2 h-4 w-full rounded bg-[oklch(1_0_0_/_6%)]" />
              <div className="mb-4 h-4 w-4/5 rounded bg-[oklch(1_0_0_/_5%)]" />
              <div className="h-11 rounded-2xl bg-[oklch(1_0_0_/_6%)]" />
            </div>
          ))}

        {!loading && feed?.cards.length === 0 && (
          <div
            className="world-card relative col-span-full flex flex-col items-center justify-center overflow-hidden border px-6 py-20 text-center transition-all duration-500 hover:border-opacity-50"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--world-accent) 15%, transparent), transparent 70%), var(--world-surface, var(--v2-surface))",
              borderColor: "color-mix(in oklch, var(--world-accent) 20%, transparent)",
              boxShadow: "inset 0 1px 0 0 color-mix(in oklch, var(--world-accent) 10%, transparent)",
            }}
          >
            <div className="relative mb-8">
              <div 
                className="absolute inset-0 animate-pulse rounded-full blur-2xl"
                style={{ background: "color-mix(in oklch, var(--world-accent) 30%, transparent)", animationDuration: "3s" }}
              />
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] border transition-transform duration-500 hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, color-mix(in oklch, var(--world-accent) 15%, transparent), color-mix(in oklch, var(--world-accent) 5%, transparent))",
                  borderColor: "color-mix(in oklch, var(--world-accent) 30%, transparent)",
                  color: "var(--world-accent)",
                  boxShadow: "0 12px 40px color-mix(in oklch, var(--world-accent) 25%, transparent), inset 0 2px 0 0 color-mix(in oklch, #ffffff 15%, transparent)",
                }}
              >
                <Brain className="h-10 w-10" />
              </div>
            </div>
            
            <h3
              className="text-2xl font-bold tracking-tight md:text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The forge is quiet
            </h3>
            
            <p
              className="mt-4 max-w-md text-sm leading-relaxed md:text-base"
              style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
            >
              Your daily recall deck is forged from your recent logs. Chronicle your progress today to unlock tomorrow&apos;s edge.
            </p>
          </div>
        )}

        {!loading &&
          feed?.cards.map((card, index) => {
            const key = `${card.sourceDate}-${card.category}-${index}`;
            const revealed = revealedKeys.includes(key);
            const rarityMeta = RARITY_META[card.rarity];
            const Icon = rarityMeta.icon;

            return (
              <article
                key={key}
                className="world-card relative overflow-hidden border p-5 transition-transform duration-200 hover:-translate-y-1"
                style={{
                  background: `radial-gradient(circle at top right, ${rarityMeta.glow}, transparent 40%), linear-gradient(180deg, oklch(1 0 0 / 3%), transparent), var(--world-surface, var(--v2-surface))`,
                  borderColor: rarityMeta.border,
                }}
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        background: rarityMeta.badgeBg,
                        color: rarityMeta.badgeText,
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {rarityMeta.label}
                    </div>

                    <div>
                      <h2
                        className="text-xl font-bold tracking-tight"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {card.title}
                      </h2>
                      <p
                        className="mt-1 text-xs uppercase tracking-[0.16em]"
                        style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}
                      >
                        {card.category} • {card.sourceDate}
                      </p>
                    </div>
                  </div>

                  <Brain
                    className="h-5 w-5"
                    style={{ color: "var(--world-accent, var(--v2-amber-400))" }}
                  />
                </div>

                <div
                  className="rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: "oklch(1 0 0 / 8%)",
                    background: "oklch(1 0 0 / 2%)",
                  }}
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}
                  >
                    Recall Prompt
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">{card.prompt}</p>
                </div>

                <p
                  className="mt-4 text-sm leading-relaxed"
                  style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
                >
                  {card.why}
                </p>

                <button
                  onClick={() => toggleReveal(key)}
                  className="mt-5 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors duration-200"
                  style={{
                    borderColor: "oklch(1 0 0 / 8%)",
                    background: revealed
                      ? "color-mix(in oklch, var(--world-accent) 10%, transparent)"
                      : "oklch(1 0 0 / 2%)",
                  }}
                >
                  <span>
                    <span
                      className="block text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        color: "var(--world-text-muted, var(--v2-text-muted))",
                      }}
                    >
                      Answer
                    </span>
                    <span className="mt-1 block text-sm font-medium">
                      {revealed ? card.answer : "Reveal when you want the check"}
                    </span>
                  </span>

                  {revealed ? (
                    <ChevronUp className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  )}
                </button>
              </article>
            );
          })}
      </section>
    </div>
  );
}
