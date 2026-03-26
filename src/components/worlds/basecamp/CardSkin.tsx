"use client";

import { ReactNode, CSSProperties } from "react";
import { useMomentum } from "@/components/MomentumProvider";
import theme from "./theme";

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Basecamp Card — clean flat card with subtle border. */
export default function CardSkin({ children, className = "", style }: Props) {
  const { microInteractions } = useMomentum();
  const { hoverLift, hoverGlow, hoverRipple, cardEntrance } = microInteractions;

  const interactionClasses = [
    hoverLift && "world-hover-lift",
    hoverGlow && "world-hover-glow",
    hoverRipple && "world-hover-ripple",
    cardEntrance !== "none" && `entrance-${cardEntrance}`,
    "world-card" // marker for css global overrides
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
        transition: "box-shadow 300ms ease, transform 300ms ease, border-color 300ms ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
