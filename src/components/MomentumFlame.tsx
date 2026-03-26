"use client";

import { useMomentum } from "@/components/MomentumProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";
import type { DailyEnergy, StreakPower } from "@/lib/momentum";

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

const ENERGY_SCALE: Record<DailyEnergy, number> = {
  0: 0.4, 1: 0.55, 2: 0.7, 3: 0.8, 4: 0.9, 5: 1.0,
};

export default function MomentumFlame() {
  const { dailyEnergy, streakPower, streakDays, todayHours, loading } = useMomentum();
  const { CardSkin, theme } = useWorld();
  const config = STREAK_CONFIG[streakPower];
  const scale = ENERGY_SCALE[dailyEnergy];
  const hasGradient = !!theme.accentGradient && streakDays >= 3;

  if (loading) {
    return (
      <CardSkin className="flex items-center justify-center" style={{ minHeight: 140 }}>
        <span style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}>—</span>
      </CardSkin>
    );
  }

  return (
    <CardSkin className="relative flex flex-col items-center justify-center" style={{ minHeight: 140 }}>
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
                bottom: `${20 + Math.random() * 40}%`,
                animation: `flame-particle-rise ${1.5 + (i % 3) * 0.5}s ease-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="relative z-10 text-center">
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
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}
        >
          Streak
        </p>
        <p
          className="mt-1 text-[10px] tabular-nums"
          style={{ color: theme.textMuted, fontFamily: "var(--font-display)" }}
        >
          {todayHours.toFixed(2)}h today
        </p>
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
