"use client";

import { type ReactNode, type CSSProperties } from "react";
import { useWorld } from "@/components/worlds/WorldRenderer";

interface WorldCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Drop-in replacement for <Card> that auto-themes with the active world skin.
 *
 * Internally delegates to the current tier's CardSkin component,
 * which applies world-specific colors, borders, shadows, and
 * micro-interaction CSS classes (hover-lift, entrance animations, etc.).
 *
 * Usage:
 *   // Before:  <Card className="p-6 border" style={{ background: "var(--v2-surface)" }}>
 *   // After:   <WorldCard className="p-6">
 *
 * The CardSkin handles background, border, shadow, and padding automatically.
 * Pass `style={{ padding: 0 }}` if you need custom internal padding.
 */
export default function WorldCard({ children, className = "", style }: WorldCardProps) {
  const { CardSkin } = useWorld();
  return (
    <CardSkin className={className} style={style}>
      {children}
    </CardSkin>
  );
}
