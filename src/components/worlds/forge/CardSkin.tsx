"use client";

import { ReactNode, CSSProperties } from "react";
import { useMomentum } from "@/components/MomentumProvider";
import theme from "./theme";

interface Props { children: ReactNode; className?: string; style?: CSSProperties; }

/** Iron Forge Card — hard specular metal surface. Sharp top highlight, heavy shadow.
 *  Feels like stamped steel, not warm wood. */
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
        border: `1px solid ${theme.border}`,
        borderRadius: theme.borderRadius,
        boxShadow: theme.shadowCard,
        padding: theme.spacing,
        transition: "box-shadow 400ms ease, transform 400ms ease, border-color 400ms ease",
        ...style,
      }}
    >
      {/* Hard specular top edge — sharp metallic reflection */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, transparent 5%, oklch(1 0 0 / 14%) 30%, oklch(1 0 0 / 10%) 50%, oklch(1 0 0 / 14%) 70%, transparent 95%)` }}
      />
      {/* Hard specular left edge — vertical metal sheen */}
      <div
        className="absolute inset-y-0 left-0 w-[1px]"
        style={{ background: `linear-gradient(180deg, oklch(1 0 0 / 8%) 10%, oklch(1 0 0 / 3%) 50%, transparent 90%)` }}
      />
      {/* Shimmer accent line at bottom — brighter, harder */}
      <div
        className="absolute inset-x-3 bottom-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
          opacity: 0.4,
        }}
      />
      {children}
    </div>
  );
}
