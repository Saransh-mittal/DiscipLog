"use client";

import { useEffect, useState, useRef } from "react";
import confetti from "canvas-confetti";
import { LEVEL_UP_MESSAGES } from "./types";
import type { WorldTheme } from "./types";

/** LevelUpModal — celebration overlay when the user unlocks a new tier.
 *  Shows once per tier unlock (tracked in localStorage).
 *  Adapts colors to the newly-unlocked tier's theme. */
export default function LevelUpModal({
  tier,
  theme,
}: {
  tier: number;
  theme: WorldTheme;
}) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"enter" | "idle" | "exit">("enter");
  const config = LEVEL_UP_MESSAGES[tier];
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!config || tier === 0) return;
    const key = `world-tier-seen-${tier}`;
    if (localStorage.getItem(key)) return;
    setVisible(true);
    setPhase("enter");
    confettiFired.current = false;
  }, [tier, config]);

  // Fire confetti when modal appears
  useEffect(() => {
    if (!visible || confettiFired.current) return;
    confettiFired.current = true;

    const accentColor = theme.accent;
    const textColor = theme.textPrimary;
    const duration = 2500;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.6 },
        colors: [accentColor, textColor, "oklch(0.9 0.05 100)"],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.6 },
        colors: [accentColor, textColor, "oklch(0.9 0.05 100)"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [visible, theme.accent, theme.textPrimary]);

  if (!visible || !config) return null;

  const dismiss = () => {
    setPhase("exit");
    setTimeout(() => {
      localStorage.setItem(`world-tier-seen-${tier}`, "1");
      setVisible(false);
    }, 400);
  };

  // Derive modal colors from the target tier theme
  const modalBg = theme.surface;
  const modalBorder = theme.border;
  const accentColor = theme.accent;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "oklch(0 0 0 / 75%)",
        backdropFilter: "blur(12px)",
        animation: phase === "enter"
          ? "level-up-backdrop 0.5s ease-out"
          : phase === "exit"
            ? "level-up-backdrop-out 0.4s ease-in forwards"
            : undefined,
      }}
      onClick={dismiss}
    >
      <div
        className="relative max-w-sm w-full mx-5 text-center overflow-hidden"
        style={{
          background: modalBg,
          borderRadius: theme.borderRadius,
          border: `1px solid ${modalBorder}`,
          boxShadow: `0 0 60px ${theme.accentGlow}, 0 24px 80px oklch(0 0 0 / 50%)`,
          animation: phase === "enter"
            ? "level-up-card 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
            : phase === "exit"
              ? "level-up-card-out 0.35s ease-in forwards"
              : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div
          style={{
            height: 2,
            background: `linear-gradient(90deg, transparent 5%, ${accentColor} 50%, transparent 95%)`,
            opacity: 0.7,
          }}
        />

        <div className="p-8 pt-7">
          {/* "NEW WORLD" badge */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-5"
            style={{
              background: `color-mix(in oklch, ${accentColor} 12%, transparent)`,
              border: `1px solid color-mix(in oklch, ${accentColor} 25%, transparent)`,
            }}
          >
            <span
              className="text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{
                color: accentColor,
                fontFamily: "var(--font-body)",
              }}
            >
              World Unlocked
            </span>
          </div>

          {/* Emoji with glow */}
          <div className="relative inline-block mb-4">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${theme.accentGlow}, transparent 70%)`,
                filter: "blur(16px)",
                transform: "scale(2.5)",
                opacity: 0.5,
              }}
              aria-hidden="true"
            />
            <div
              className="relative text-6xl"
              style={{
                animation: "level-up-emoji 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both",
              }}
            >
              {config.emoji}
            </div>
          </div>

          {/* Title */}
          <h2
            className="text-2xl font-extrabold tracking-tight mb-1"
            style={{
              fontFamily: "var(--font-display)",
              color: theme.textPrimary,
            }}
          >
            {config.title}
          </h2>

          {/* Subtitle */}
          <p
            className="text-sm font-semibold mb-4"
            style={{
              color: accentColor,
              fontFamily: "var(--font-body)",
              letterSpacing: "0.04em",
            }}
          >
            {config.subtitle}
          </p>

          {/* Description */}
          <p
            className="text-sm mb-7 leading-relaxed max-w-xs mx-auto"
            style={{
              color: theme.textSecondary,
              fontFamily: "var(--font-body)",
            }}
          >
            {config.description}
          </p>

          {/* CTA Button */}
          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: accentColor,
              color: theme.bg,
              fontFamily: "var(--font-display)",
              letterSpacing: "0.02em",
              boxShadow: `0 0 24px ${theme.accentGlow}`,
            }}
          >
            Enter {config.title} →
          </button>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent 10%, color-mix(in oklch, ${accentColor} 20%, transparent) 50%, transparent 90%)`,
          }}
        />
      </div>

      <style>{`
        @keyframes level-up-backdrop {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes level-up-backdrop-out {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes level-up-card {
          0% { opacity: 0; transform: scale(0.85) translateY(30px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes level-up-card-out {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.92) translateY(-10px); }
        }
        @keyframes level-up-emoji {
          0% { transform: scale(0) rotate(-15deg); }
          60% { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
