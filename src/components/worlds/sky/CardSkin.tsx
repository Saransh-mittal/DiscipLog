"use client";

import { ReactNode, CSSProperties } from "react";
import { useMomentum } from "@/components/MomentumProvider";
import theme from "./theme";

interface Props { children: ReactNode; className?: string; style?: CSSProperties; }

/** Sky Citadel Card — frosted glass with backdrop blur and translucent borders. */
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
        transition: "box-shadow 500ms ease, transform 500ms ease, border-color 500ms ease",
        ...style,
      }}
    >
      {/* Glass refraction highlight */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent 5%, oklch(1 0 0 / 12%) 30%, oklch(1 0 0 / 6%) 70%, transparent 95%)" }}
      />
      {children}
    </div>
  );
}
