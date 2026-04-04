"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  TimerReset,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorld } from "@/components/worlds/WorldRenderer";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  SMART_RECALL_LOG_SAVED_EVENT,
  type SmartRecallRarity,
  type SmartRecallSummary,
} from "@/lib/smart-recall-types";
import AIChatDrawer from "./AIChatDrawer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface SmartRecallContextValue {
  summary: SmartRecallSummary | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: (options?: { openIfReady?: boolean; silent?: boolean }) => Promise<void>;
  startRecall: () => void;
  openTutorial: () => void;
}

const SmartRecallContext = createContext<SmartRecallContextValue>({
  summary: null,
  loading: true,
  refreshing: false,
  error: null,
  refresh: async () => {},
  startRecall: () => {},
  openTutorial: () => {},
});

const RARITY_META: Record<
  SmartRecallRarity,
  {
    label: string;
    icon: typeof Sparkles;
  }
> = {
  spark: { label: "Spark", icon: Sparkles },
  forge: { label: "Forge", icon: Shield },
  boss: { label: "Boss", icon: Swords },
};

function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatDueLabel(dateString: string | null, timezone: string): string {
  if (!dateString) {
    return "Soon";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function RarityBadge({
  rarity,
}: {
  rarity: SmartRecallRarity;
}) {
  const { theme } = useWorld();
  const meta = RARITY_META[rarity];
  const Icon = meta.icon;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{
        background: "color-mix(in oklch, var(--world-accent) 12%, transparent)",
        color: theme.accent,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </div>
  );
}

function RecallMarkdown({ content }: { content: string }) {
  const { theme } = useWorld();
  
  const components: Components = useMemo(
    () => ({
      p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-base">{children}</p>,
      strong: ({ children }) => (
        <strong style={{ color: theme.textPrimary, fontWeight: 700 }}>{children}</strong>
      ),
      em: ({ children }) => (
        <em style={{ fontStyle: "italic", color: theme.textSecondary }}>{children}</em>
      ),
      h1: ({ children }) => (
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "18px",
            fontWeight: 800,
            color: theme.textPrimary,
            margin: "1.2em 0 0.5em 0",
          }}
        >
          {children}
        </h3>
      ),
      h2: ({ children }) => (
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "16px",
            fontWeight: 800,
            color: theme.textPrimary,
            margin: "1em 0 0.4em 0",
          }}
        >
          {children}
        </h4>
      ),
      h3: ({ children }) => (
        <h5
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "15px",
            fontWeight: 700,
            color: theme.textPrimary,
            margin: "0.8em 0 0.3em 0",
          }}
        >
          {children}
        </h5>
      ),
      ul: ({ children }) => (
        <ul
          style={{
            margin: "0.5em 0 1em 0",
            paddingLeft: "1.2em",
            listStyleType: "disc",
            color: theme.textPrimary,
          }}
        >
          {children}
        </ul>
      ),
      ol: ({ children }) => (
        <ol
          style={{
            margin: "0.5em 0 1em 0",
            paddingLeft: "1.2em",
            listStyleType: "decimal",
            color: theme.textPrimary,
          }}
        >
          {children}
        </ol>
      ),
      li: ({ children }) => <li style={{ marginBottom: "0.3em" }}>{children}</li>,
      code: ({ children, className }) => {
        const isBlock = className?.startsWith("language-");
        if (isBlock) {
          return (
            <code
              style={{
                display: "block",
                background: "color-mix(in oklch, var(--world-surface-raised) 60%, transparent)",
                border: `1px solid color-mix(in oklch, ${theme.accent} 20%, transparent)`,
                borderRadius: "8px",
                padding: "0.8em 1em",
                fontSize: "13px",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                overflowX: "auto",
                margin: "0.6em 0 1em 0",
                whiteSpace: "pre-wrap",
                color: theme.textSecondary,
              }}
            >
              {children}
            </code>
          );
        }
        return (
          <code
            style={{
              background: "color-mix(in oklch, var(--world-surface-raised) 70%, transparent)",
              borderRadius: "4px",
              padding: "0.15em 0.3em",
              fontSize: "13px",
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              color: theme.accent,
            }}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }) => <pre style={{ margin: 0, overflow: "hidden" }}>{children}</pre>,
      a: ({ children, href }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: theme.accent,
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}
        >
          {children}
        </a>
      ),
      blockquote: ({ children }) => (
        <blockquote
          style={{
            borderLeft: `3px solid ${theme.accent}`,
            paddingLeft: "1em",
            margin: "0.8em 0 1em 0",
            color: theme.textSecondary,
            fontStyle: "italic",
            background: "color-mix(in oklch, var(--world-accent) 5%, transparent)",
            padding: "0.8em 1em",
            borderRadius: "0 8px 8px 0",
          }}
        >
          {children}
        </blockquote>
      ),
    }),
    [theme]
  );

  return (
    <div className="recall-markdown whitespace-normal break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Guided Tour Overlay — renders ON TOP of the live recall card
   ──────────────────────────────────────────────────────────── */

const TOUR_STEPS = [
  {
    zone: "intro",
    title: "Welcome to Smart Recall",
    body: "Recall cards are forged from your real logs — the app brings back patterns, fixes, and lessons worth keeping alive. This is a bonus loop, not extra homework.",
    icon: Brain,
  },
  {
    zone: "prompt",
    title: "The Recall Prompt",
    body: "This is your cue. Try to recall the answer from memory before peeking. Active recall is what makes the lesson stick.",
    icon: Flame,
  },
  {
    zone: "answer",
    title: "Reveal & Check",
    body: "Once you've tried to recall, reveal the answer to see how you did. Honest self-assessment is the whole point.",
    icon: Sparkles,
  },
  {
    zone: "actions",
    title: "Got It or Need Again",
    body: "\"Got it\" removes the card for good. \"Need again\" brings it back in 1 hour. Use Got it only when the lesson is truly back in your head.",
    icon: TimerReset,
  },
] as const;

function GuidedTourOverlay({
  step,
  onNext,
  onBack,
  onClose,
  isFinishing,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  isFinishing: boolean;
}) {
  const { theme, tier } = useWorld();
  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div className="recall-tour-overlay">
      {/* Dark mask over entire viewport */}
      <div className="recall-tour-mask" onClick={onClose} />

      <DialogPrimitive.Title className="sr-only">Smart Recall Tour</DialogPrimitive.Title>

      {/* Tour tooltip — always centered */}
      <div
        className="recall-tour-tooltip"
        style={{
          "--tour-accent": theme.accent,
          "--tour-accent-glow": theme.accentGlow ?? theme.accent,
        } as CSSProperties}
      >
        {/* Top accent bar */}
        <div
          className="recall-tour-accent-bar"
          style={{
            background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
            opacity: tier >= 2 ? 0.7 : 0.45,
          }}
        />

        {/* Close */}
        <button
          onClick={onClose}
          className="recall-tour-close"
          aria-label="Skip tour"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Content */}
        <div className="recall-tour-content">
          {/* Icon badge */}
          <div
            className="recall-tour-icon"
            style={{
              background: `radial-gradient(circle at 30% 20%, color-mix(in oklch, ${theme.accent} 18%, transparent), transparent 65%)`,
              borderColor: `color-mix(in oklch, ${theme.accent} 28%, transparent)`,
              color: theme.accent,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>

          {/* Step label */}
          <div
            className="recall-tour-step-badge"
            style={{
              color: theme.accent,
              borderColor: `color-mix(in oklch, ${theme.accent} 24%, transparent)`,
              background: `linear-gradient(135deg, color-mix(in oklch, ${theme.accent} 10%, transparent), transparent)`,
            }}
          >
            Step {step + 1} of {TOUR_STEPS.length}
          </div>

          {/* Title + body */}
          <h3
            className="recall-tour-title"
            style={{ fontFamily: "var(--font-display)", color: theme.textPrimary }}
          >
            {current.title}
          </h3>
          <p className="recall-tour-body" style={{ color: theme.textSecondary }}>
            {current.body}
          </p>
        </div>

        {/* Footer: dots + buttons */}
        <div className="recall-tour-footer">
          {/* Dots */}
          <div className="recall-tour-dots">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className="recall-tour-dot"
                style={{
                  width: i === step ? 24 : 8,
                  background:
                    i === step
                      ? theme.accent
                      : "color-mix(in oklch, var(--world-text-muted) 30%, transparent)",
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="recall-tour-btns">
            {!isFirst && (
              <Button
                onClick={onBack}
                variant="outline"
                size="sm"
                className="rounded-full"
                style={{
                  borderColor: `color-mix(in oklch, ${theme.accent} 18%, transparent)`,
                  color: theme.textSecondary,
                  background: "transparent",
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              onClick={onNext}
              disabled={isFinishing}
              size="sm"
              className="rounded-full px-5"
              style={{
                background: theme.accent,
                color: tier === 4 ? "oklch(0.12 0.01 70)" : "oklch(0.12 0.01 250)",
              }}
            >
              {isLast ? (
                isFinishing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Finishing
                  </>
                ) : (
                  <>
                    Start Reviewing
                    <ChevronRight className="h-4 w-4" />
                  </>
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Recall Session Panel — the live recall card (unchanged logic)
   ──────────────────────────────────────────────────────────── */

function RecallSessionPanel({
  summary,
  revealed,
  onReveal,
  onSnooze,
  onComplete,
  onClose,
  onAskAI,
  actionLoading,
  timezone,
}: {
  summary: SmartRecallSummary;
  revealed: boolean;
  onReveal: () => void;
  onSnooze: () => void;
  onComplete: () => void;
  onClose: () => void;
  onAskAI: () => void;
  actionLoading: boolean;
  timezone: string;
}) {
  const { theme, tier } = useWorld();
  const card = summary.activeCard;

  if (!card) {
    return null;
  }

  // Build solid opaque colors from the theme
  // Strip any alpha from theme.surface to ensure full opacity
  const solidSurface = theme.surface.replace(/\s*\/\s*[\d.]+%?\s*\)/, ")");
  const solidSurfaceRaised = theme.surfaceRaised.replace(/\s*\/\s*[\d.]+%?\s*\)/, ")");
  const accentLineOpacity = tier >= 3 ? 0.7 : tier >= 2 ? 0.55 : tier >= 1 ? 0.4 : 0.3;

  return (
    <div
      className="recall-session-card relative mx-auto w-full max-w-2xl overflow-hidden"
      style={{
        background: solidSurface,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.borderRadius,
        boxShadow: theme.shadowCard,
      }}
    >
      {/* Accent line */}
      <div
        className="h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
          opacity: accentLineOpacity,
        }}
      />

      <DialogPrimitive.Title className="sr-only">Smart Recall Bonus</DialogPrimitive.Title>

      <div className="relative p-6 md:p-8">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
          style={{
            borderColor: `color-mix(in oklch, ${theme.accent} 22%, transparent)`,
            color: theme.textMuted,
            background: solidSurfaceRaised,
          }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-6">
          {/* Header badges */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{
                  borderColor: `color-mix(in oklch, ${theme.accent} 22%, transparent)`,
                  color: theme.accent,
                  background: solidSurfaceRaised,
                }}
              >
                <Brain className="h-3.5 w-3.5" />
                Recall Bonus
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <RarityBadge rarity={card.rarity} />
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: theme.textMuted }}
                >
                  {summary.dueCount} ready now
                </span>
              </div>
            </div>

            <div
              className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                borderColor: `color-mix(in oklch, ${theme.accent} 18%, transparent)`,
                color: theme.textMuted,
                background: solidSurfaceRaised,
              }}
            >
              {card.category} • {card.sourceDate} • {formatDueLabel(card.dueAt, timezone)}
            </div>
          </div>

          {/* Title + description */}
          <div>
            <h2
              className="text-3xl font-extrabold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-display)", color: theme.textPrimary }}
            >
              {card.title}
            </h2>
            <p
              className="mt-3 max-w-2xl text-sm leading-relaxed md:text-base"
              style={{ color: theme.textSecondary }}
            >
              {card.why}
            </p>
          </div>

          {/* Prompt zone — solid opaque */}
          <div
            className="recall-session-prompt border px-5 py-5"
            style={{
              borderColor: `color-mix(in oklch, ${theme.accent} 20%, transparent)`,
              background: solidSurfaceRaised,
              borderRadius: theme.borderRadius,
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: theme.accent }}
            >
              Recall Prompt
            </p>
            <div className="mt-3">
               <RecallMarkdown content={card.prompt} />
            </div>
          </div>

          {/* Answer zone — solid opaque */}
          <div
            className="recall-session-answer border px-5 py-5"
            style={{
              borderColor: revealed
                ? `color-mix(in oklch, ${theme.accent} 24%, transparent)`
                : theme.border,
              background: solidSurfaceRaised,
              borderRadius: theme.borderRadius,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: theme.textMuted }}
              >
                Answer Check
              </p>

              {!revealed && (
                <Button
                  onClick={onReveal}
                  size="sm"
                  className="rounded-full px-4"
                  style={{
                    background: theme.accent,
                    color: tier === 4 ? "oklch(0.12 0.01 70)" : "oklch(0.12 0.01 250)",
                    border: "none",
                  }}
                >
                  Reveal Answer
                </Button>
              )}
            </div>

            <div
              className="mt-3 max-h-[40vh] overflow-y-auto pr-1 transition-opacity duration-300"
              style={{
                color: revealed ? theme.textPrimary : theme.textMuted,
                opacity: revealed ? 1 : 0.72,
              }}
            >
              {revealed ? (
                <RecallMarkdown content={card.answer} />
              ) : (
                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  Try to recall it before you open the answer.
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {revealed && (
            <>
              <div className="recall-session-actions flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={onSnooze}
                  disabled={actionLoading}
                  variant="outline"
                  className="h-11 flex-1 rounded-full"
                  style={{
                    borderColor: `color-mix(in oklch, ${theme.accent} 22%, transparent)`,
                    background: solidSurfaceRaised,
                    color: theme.textSecondary,
                  }}
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Updating
                    </>
                  ) : (
                    <>
                      <Clock3 className="h-4 w-4" />
                      Need Again
                    </>
                  )}
                </Button>

                <Button
                  onClick={onComplete}
                  disabled={actionLoading}
                  className="h-11 flex-1 rounded-full"
                  style={{
                    background: theme.accent,
                    color: tier === 4 ? "oklch(0.12 0.01 70)" : "oklch(0.12 0.01 250)",
                  }}
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Updating
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Got It
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={onAskAI}
                  disabled={actionLoading}
                  variant="outline"
                  className="h-11 flex-[0.5] rounded-full border-dashed"
                  style={{
                    borderColor: `color-mix(in oklch, ${theme.accent} 40%, transparent)`,
                    background: "transparent",
                    color: theme.accent,
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </Button>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                Need Again brings this card back in 1 hour. Got It removes it from the queue for good.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function useSmartRecall() {
  return useContext(SmartRecallContext);
}

export default function SmartRecallProvider({
  children,
}: {
  children: ReactNode;
}) {
  const timezone = useMemo(getTimezone, []);
  const [summary, setSummary] = useState<SmartRecallSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [startSessionAfterTour, setStartSessionAfterTour] = useState(false);
  const sessionOpenRef = useRef(false);
  const tourOpenRef = useRef(false);

  useEffect(() => {
    sessionOpenRef.current = sessionOpen;
  }, [sessionOpen]);

  useEffect(() => {
    tourOpenRef.current = tourOpen;
  }, [tourOpen]);

  const refresh = useCallback(
    async (options?: { openIfReady?: boolean; silent?: boolean }) => {
      const openIfReady = options?.openIfReady ?? false;
      const silent = options?.silent ?? false;

      if (!silent) {
        setRefreshing(true);
      }

      try {
        const res = await fetch(`/api/recall?timezone=${encodeURIComponent(timezone)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = (await res.json()) as SmartRecallSummary;
        setSummary(data);
        setError(null);

        if (
          openIfReady &&
          data.state === "ready" &&
          data.activeCard &&
          !sessionOpenRef.current &&
          !tourOpenRef.current
        ) {
          setRevealed(false);
          if (!data.tutorialSeen) {
            setStartSessionAfterTour(true);
            setTourStep(0);
            setTourOpen(true);
          } else {
            setSessionOpen(true);
          }
        }
      } catch {
        setError("Could not load smart recall.");
      } finally {
        setLoading(false);
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [timezone]
  );

  useEffect(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useEffect(() => {
    if (!summary?.nextDueAt) {
      return;
    }

    const delay = Math.max(500, new Date(summary.nextDueAt).getTime() - Date.now() + 400);
    const timer = window.setTimeout(() => {
      void refresh({ silent: true });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [refresh, summary?.nextDueAt]);

  useEffect(() => {
    const handleLogSaved = () => {
      void refresh({ openIfReady: true });
    };

    window.addEventListener(SMART_RECALL_LOG_SAVED_EVENT, handleLogSaved);
    return () => {
      window.removeEventListener(SMART_RECALL_LOG_SAVED_EVENT, handleLogSaved);
    };
  }, [refresh]);

  const startRecall = useCallback(() => {
    // Guard: don't start while still loading — tutorialSeen may not be resolved yet
    if (loading) return;
    if (!summary?.activeCard || summary.state !== "ready") {
      return;
    }

    setRevealed(false);
    if (!summary.tutorialSeen) {
      setStartSessionAfterTour(true);
      setTourStep(0);
      setTourOpen(true);
      return;
    }

    setSessionOpen(true);
  }, [summary, loading]);

  const openTutorial = useCallback(() => {
    setStartSessionAfterTour(false);
    setTourStep(0);
    setTourOpen(true);
  }, []);

  const closeSession = useCallback(() => {
    setSessionOpen(false);
    setTourOpen(false);
    setDrawerOpen(false);
    setRevealed(false);
  }, []);

  const runCardAction = useCallback(
    async (action: "complete" | "snooze") => {
      if (!summary?.activeCard) {
        return;
      }

      setActionLoading(true);

      try {
        const res = await fetch(`/api/recall/${summary.activeCard.id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone }),
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = (await res.json()) as SmartRecallSummary;
        setSummary(data);
        setRevealed(false);
        setError(null);

        if (data.state === "ready" && data.activeCard) {
          setSessionOpen(true);
        } else {
          setSessionOpen(false);
        }
      } catch {
        setError("Could not update this recall card.");
      } finally {
        setActionLoading(false);
      }
    },
    [summary, timezone]
  );

  const handleTourNext = useCallback(async () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep((current) => current + 1);
      return;
    }

    // Last step — mark tutorial as seen
    setActionLoading(true);

    try {
      const res = await fetch("/api/recall/tutorial/seen", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setSummary((current) =>
        current
          ? {
              ...current,
              tutorialSeen: true,
            }
          : current
      );
      setTourOpen(false);

      // After tour completes, open the session if we came from startRecall
      if (startSessionAfterTour && summary?.activeCard) {
        setSessionOpen(true);
      }
    } catch {
      setError("Could not save the recall tutorial state.");
    } finally {
      setActionLoading(false);
      setStartSessionAfterTour(false);
    }
  }, [startSessionAfterTour, summary?.activeCard, tourStep]);

  const handleTourBack = useCallback(() => {
    if (tourStep > 0) {
      setTourStep((current) => current - 1);
    }
  }, [tourStep]);

  const value = useMemo<SmartRecallContextValue>(
    () => ({
      summary,
      loading,
      refreshing,
      error,
      refresh,
      startRecall,
      openTutorial,
    }),
    [summary, loading, refreshing, error, refresh, startRecall, openTutorial]
  );

  return (
    <SmartRecallContext.Provider value={value}>
      {children}

      {/* ── Guided Tour (standalone, no session behind it) ── */}
      <DialogPrimitive.Root
        open={tourOpen && !sessionOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTourOpen(false);
            setStartSessionAfterTour(false);
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content asChild aria-describedby={undefined}>
            <div className="recall-tour-fullscreen">
              <div className="recall-tour-fullscreen-mask" />
              <GuidedTourOverlay
                step={tourStep}
                onNext={() => {
                  void handleTourNext();
                }}
                onBack={handleTourBack}
                onClose={() => {
                  setTourOpen(false);
                  setStartSessionAfterTour(false);
                }}
                isFinishing={actionLoading}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ── Recall Session Fullscreen Overlay ── */}
      <DialogPrimitive.Root
        open={sessionOpen && !tourOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSession();
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content asChild aria-describedby={undefined}>
            <div className="recall-session-backdrop">
              {/* Backdrop click to close */}
              <div
                className="absolute inset-0"
                onClick={closeSession}
              />

              {/* Session card */}
              <div className="recall-session-container">
                {summary && summary.activeCard ? (
                  <>
                    <RecallSessionPanel
                      summary={summary}
                      revealed={revealed}
                      onReveal={() => setRevealed(true)}
                      onSnooze={() => {
                        void runCardAction("snooze");
                      }}
                      onComplete={() => {
                        void runCardAction("complete");
                      }}
                      onClose={closeSession}
                      onAskAI={() => setDrawerOpen(true)}
                      actionLoading={actionLoading}
                      timezone={timezone}
                    />
                    <AIChatDrawer
                      mode={{
                        type: "recall",
                        cardId: summary.activeCard.id,
                        cardTitle: summary.activeCard.title,
                        category: summary.activeCard.category,
                      }}
                      isOpen={drawerOpen}
                      onClose={() => setDrawerOpen(false)}
                      timezone={timezone}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </SmartRecallContext.Provider>
  );
}
