"use client";

import { useMomentum } from "@/components/MomentumProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";
import type { StreakPower } from "@/lib/momentum";
import type { WorldTheme } from "@/components/worlds/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TierConfig {
  particleCount: number;
  emoji: string;
  showGlow: boolean;
}

const STREAK_CONFIG: Record<StreakPower, TierConfig> = {
  0: { particleCount: 0, emoji: "💤", showGlow: false },
  1: { particleCount: 2, emoji: "🔥", showGlow: false },
  2: { particleCount: 4, emoji: "🔥", showGlow: true },
  3: { particleCount: 6, emoji: "⚡", showGlow: true },
  4: { particleCount: 0, emoji: "👑", showGlow: false },
};

function formatRemainingHours(hours: number) {
  if (hours >= 1) {
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  }

  return `${Math.round(hours * 60)}m`;
}

function getBadgeVisuals(
  theme: WorldTheme,
  tier: number,
  status: "secured" | "continuing" | "revivable"
) {
  const radius = tier === 2 ? "10px" : tier >= 3 ? "999px" : theme.borderRadius;

  if (status === "secured") {
    return {
      background: `color-mix(in oklch, ${theme.accent} 14%, ${theme.surfaceRaised})`,
      borderColor: `color-mix(in oklch, ${theme.accent} 34%, ${theme.border})`,
      color: theme.accent,
      boxShadow: tier === 4 ? "none" : `0 0 14px ${theme.accentGlow}`,
      borderRadius: radius,
    };
  }

  if (status === "revivable") {
    return {
      background: `color-mix(in oklch, ${theme.accent} ${tier >= 3 ? 16 : 20}%, ${theme.surfaceRaised})`,
      borderColor: `color-mix(in oklch, ${theme.accent} ${tier >= 3 ? 36 : 44}%, ${theme.border})`,
      color: tier === 4 ? theme.accent : theme.textPrimary,
      boxShadow: tier === 4 ? "none" : `0 0 ${tier === 3 ? 18 : 12}px ${theme.accentGlow}`,
      borderRadius: radius,
    };
  }

  return {
    background: `color-mix(in oklch, ${theme.accent} ${tier >= 3 ? 8 : 10}%, ${theme.surfaceRaised})`,
    borderColor: `color-mix(in oklch, ${theme.accent} ${tier >= 3 ? 18 : 22}%, ${theme.border})`,
    color: tier === 4 ? theme.textSecondary : theme.textPrimary,
    boxShadow: "none",
    borderRadius: radius,
  };
}

export default function MomentumFlame() {
  const { streakPower, streakDays, loading, streakUnlockProgress } = useMomentum();
  const { CardSkin, theme, tier } = useWorld();
  const config = STREAK_CONFIG[streakPower];
  const hasGradient = !!theme.accentGradient && streakDays >= 3;
  const remainingLabel = formatRemainingHours(streakUnlockProgress.remainingHours);
  const isSecured = streakUnlockProgress.status === "secured";
  const isRevivable = streakUnlockProgress.status === "revivable";
  const projectedStreak = streakUnlockProgress.projectedStreak;
  const badgeVisuals = getBadgeVisuals(theme, tier, streakUnlockProgress.status);

  const badgeLabel = isSecured
    ? "✓ Momentum Secured"
    : isRevivable
      ? streakDays > 0
        ? `Revive to ${projectedStreak}d · ${remainingLabel}`
        : `Restart streak · ${remainingLabel}`
      : streakDays > 0
        ? `Continue to ${projectedStreak}d · ${remainingLabel}`
        : `Start streak · ${remainingLabel}`;

  const tooltipLabel = isSecured
    ? "Today's streak threshold is covered. Anything more you log is bonus momentum."
    : isRevivable
      ? streakDays > 0
        ? `Log ${remainingLabel} today to revive your streak to ${projectedStreak} days.`
        : `Log ${remainingLabel} today to restart with a 1-day streak.`
      : streakDays > 0
        ? `Log ${remainingLabel} today to continue your streak and move it to ${projectedStreak} days.`
        : `Log ${remainingLabel} today to start your streak.`;

  if (loading) {
    return (
      <CardSkin className="flex items-center justify-center" style={{ minHeight: 140 }}>
        <span style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}>—</span>
      </CardSkin>
    );
  }

  return (
    <CardSkin className="relative flex flex-col items-center justify-center" style={{ minHeight: 140, paddingBottom: "1.5rem" }}>
      {/* Accent glow behind emoji — NOT at tier 4 */}
      {config.showGlow && (
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full"
          style={{
            background: `radial-gradient(circle, ${theme.accentGlow}, transparent 70%)`,
            filter: "blur(12px)",
            opacity: 0.5 + streakPower * 0.1,
          }}
          aria-hidden="true"
        />
      )}

      {/* Particles — ZERO at tier 4 */}
      {config.particleCount > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {Array.from({ length: config.particleCount }).map((_, i) => (
            <span
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: theme.accent,
                opacity: 0.3,
                left: `${15 + (i / config.particleCount) * 70}%`,
                bottom: `${24 + ((i * 17) % 5) * 7}%`,
                animation: `flame-particle-rise ${1.5 + (i % 3) * 0.5}s ease-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Stats & Badge Container */}
      <div className="relative z-10 flex flex-col items-center gap-2 mt-2">
        <div className="text-center">
          <p className="text-lg mb-0.5" aria-hidden="true">{config.emoji}</p>
          <p
            className="text-2xl font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              ...(hasGradient
                ? {
                    background: theme.accentGradient,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }
                : {
                    color: streakDays >= 3 ? theme.accent : theme.textPrimary,
                  }),
              transition: `color ${streakPower === 4 ? "1200ms" : "800ms"} ease`,
            }}
          >
            {streakDays}d
          </p>
          <p
            className="text-xs font-semibold uppercase tracking-widest leading-none mt-1"
            style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}
          >
            Streak
          </p>
        </div>

        {/* Streak progress badge */}
        {streakUnlockProgress && (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  className="px-2.5 py-1 border flex items-center justify-center transition-colors duration-500 hover:opacity-80 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    background: badgeVisuals.background,
                    borderColor: badgeVisuals.borderColor,
                    borderRadius: badgeVisuals.borderRadius,
                    backdropFilter: "blur(4px)",
                    boxShadow: badgeVisuals.boxShadow,
                  }}
                >
                  <span
                    className="text-[10px] font-semibold tracking-wide"
                    style={{
                      color: badgeVisuals.color,
                      fontFamily: "var(--font-body)",
                      letterSpacing: tier === 2 ? "0.09em" : undefined,
                    }}
                  >
                    {badgeLabel}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-center p-3">
                <p>{tooltipLabel}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <style>{`
        @keyframes flame-particle-rise {
          0% { transform: translateY(0) scale(1); opacity: 0.4; }
          100% { transform: translateY(-30px) scale(0.3); opacity: 0; }
        }
      `}</style>
    </CardSkin>
  );
}
