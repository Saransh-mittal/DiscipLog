"use client";

import { ReactNode, CSSProperties } from "react";
import { useMomentum } from "@/components/MomentumProvider";
import theme from "./theme";

interface Props { children: ReactNode; className?: string; style?: CSSProperties; }

/** Ember Camp Card — warm toned cards with soft inner glow and slightly larger radius. */
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
      {/* Warm inner glow at top */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, oklch(0.68 0.14 50 / 20%), transparent)" }}
      />
      {children}
    </div>
  );
}
