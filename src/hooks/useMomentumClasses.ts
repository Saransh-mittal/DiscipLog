"use client";

import { useMemo } from "react";
import { useMomentum } from "@/components/MomentumProvider";

/**
 * Hook that returns tier-reactive CSS classes and theme helpers.
 * Use this in components that can't wrap children with WorldCard
 * (e.g. AI chat panel, custom layouts).
 *
 * Usage:
 *   const { cardClasses, entranceClass } = useMomentumClasses();
 *   <div className={`my-card ${cardClasses}`}>…</div>
 */
export function useMomentumClasses() {
  const { microInteractions } = useMomentum();

  return useMemo(() => {
    const { hoverLift, hoverGlow, hoverRipple, cardEntrance } = microInteractions;

    const parts: string[] = ["world-card"];
    if (hoverLift) parts.push("world-hover-lift");
    if (hoverGlow) parts.push("world-hover-glow");
    if (hoverRipple) parts.push("world-hover-ripple");

    const entranceClass = cardEntrance !== "none" ? `entrance-${cardEntrance}` : "";

    return {
      /** All card interaction classes combined (hover lift/glow/ripple + world-card marker) */
      cardClasses: parts.join(" "),
      /** Entrance animation class (empty string when none) */
      entranceClass,
      /** Full combined string: interactions + entrance */
      allClasses: [parts.join(" "), entranceClass].filter(Boolean).join(" "),
      /** Raw micro-interactions object for conditional logic */
      microInteractions,
    };
  }, [microInteractions]);
}
