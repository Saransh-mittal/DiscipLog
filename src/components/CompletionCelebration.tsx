"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useMomentum } from "@/components/MomentumProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";

export default function CompletionCelebration() {
  const { microInteractions, todayHours, streakDays } = useMomentum();
  const { theme } = useWorld();
  const [hasFired, setHasFired] = useState(false);

  useEffect(() => {
    // Only fire confetti if energy is 5 (100% target hit)
    if (!microInteractions.confetti) return;

    // Use a unique session key based on today's date so it fires once per day
    const todayStr = new Date().toISOString().split("T")[0];
    const sessionKey = `disciplog-confetti-${todayStr}`;

    if (!sessionStorage.getItem(sessionKey)) {
      // Fire confetti burst
      const duration = 2000;
      const end = Date.now() + duration;

      const colors = [
        theme.accent,
        theme.textPrimary,
        "oklch(0.9 0.05 100)", // standard bright fallback
      ];

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      sessionStorage.setItem(sessionKey, "fired");
      setHasFired(true);
    }
  }, [microInteractions.confetti, theme.accent, theme.textPrimary]);

  return null; // Headless
}
