"use client";

import { ReactNode, CSSProperties } from "react";
import { useMomentum } from "@/components/MomentumProvider";
import theme from "./theme";

interface Props { children: ReactNode; className?: string; style?: CSSProperties; }

/** Obsidian Sanctum Card — THE FINAL FORM.
 *  Hair-thin border. Zero shadow. Zero blur. Zero spread.
 *  Gold edge is MATERIAL — brighter top, darker bottom.
 *  Light catching metal, not glow diffusing. */
export default function CardSkin({ children, className = "", style }: Props) {
  const { microInteractions } = useMomentum();
  const { hoverLift, hoverGlow, hoverRipple, cardEntrance } = microInteractions;

  const interactionClasses = [
    hoverLift && "world-hover-lift",
    hoverGlow && "world-hover-glow",
    hoverRipple && "world-hover-ripple",
    cardEntrance !== "none" && `entrance-${cardEntrance}`,
    "world-card"
  ].filter(Boolean).join(" ");

  return (
    <div
      className={`relative overflow-hidden ${interactionClasses} ${className}`}
      style={{
        background: theme.surface,
        border: `0.5px solid ${theme.border}`,
        borderRadius: theme.borderRadius,
        padding: theme.spacing,
        transition: "box-shadow 600ms ease, transform 600ms ease, border-color 600ms ease",
        letterSpacing: "0.02em",
        ...style,
      }}
    >
      {/* Top edge — bright gold, like light hitting metal from above */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 2%, oklch(0.88 0.09 78 / 60%) 15%, oklch(0.90 0.08 78 / 50%) 50%, oklch(0.88 0.09 78 / 60%) 85%, transparent 98%)`,
        }}
      />
      {/* Bottom edge — darker gold, shadow side of the metal */}
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 10%, oklch(0.60 0.08 72 / 22%) 30%, oklch(0.60 0.08 72 / 18%) 70%, transparent 90%)`,
        }}
      />
      {children}
    </div>
  );
}
