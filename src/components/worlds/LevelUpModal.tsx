"use client";

import { useEffect, useState } from "react";
import { LEVEL_UP_MESSAGES } from "./types";

/** LevelUpModal — celebration overlay when the user unlocks a new tier.
 *  Shows once per tier unlock (tracked in localStorage). */
export default function LevelUpModal({ tier }: { tier: number }) {
  const [visible, setVisible] = useState(false);
  const config = LEVEL_UP_MESSAGES[tier];

  useEffect(() => {
    if (!config) return;
    const key = `world-tier-seen-${tier}`;
    if (localStorage.getItem(key)) return;
    setVisible(true);
  }, [tier, config]);

  if (!visible || !config) return null;

  const dismiss = () => {
    localStorage.setItem(`world-tier-seen-${tier}`, "1");
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "oklch(0 0 0 / 70%)", backdropFilter: "blur(8px)" }}
      onClick={dismiss}
    >
      <div
        className="relative max-w-md w-full mx-4 p-8 text-center"
        style={{
          background: "oklch(0.14 0.01 260 / 95%)",
          borderRadius: "20px",
          border: "1px solid oklch(1 0 0 / 10%)",
          boxShadow: "0 24px 80px oklch(0 0 0 / 50%)",
          animation: "level-up-appear 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Emoji */}
        <div className="text-6xl mb-4">{config.emoji}</div>

        {/* Title */}
        <h2
          className="text-2xl font-bold mb-1 tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "oklch(0.95 0.01 260)" }}
        >
          {config.title}
        </h2>

        {/* Subtitle */}
        <p className="text-sm font-medium mb-3" style={{ color: "oklch(0.70 0.05 260)" }}>
          {config.subtitle}
        </p>

        {/* Description */}
        <p className="text-sm mb-6 leading-relaxed" style={{ color: "oklch(0.60 0.01 260)" }}>
          {config.description}
        </p>

        {/* CTA */}
        <button
          onClick={dismiss}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{
            background: "oklch(0.65 0.10 260)",
            color: "oklch(0.98 0 0)",
            fontFamily: "var(--font-display)",
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.05)"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
        >
          Enter →
        </button>
      </div>

      <style>{`
        @keyframes level-up-appear {
          0% { opacity: 0; transform: scale(0.8) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
