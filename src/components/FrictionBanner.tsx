"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Flame, ArrowRight } from "lucide-react";

interface NudgeData {
  _id: string;
  message: string;
  tier: string;
  ctaLabel: string;
  ctaUrl: string;
}

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TIER_ACCENTS: Record<string, string> = {
  warmup: "oklch(0.7 0.15 85)",      // warm gold
  core: "oklch(0.7 0.18 30)",        // orange-red
  last_call: "oklch(0.65 0.2 25)",   // urgent red
  early_spark: "oklch(0.72 0.14 145)", // green
  evening_check: "oklch(0.7 0.15 60)", // amber
};

export default function FrictionBanner() {
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const fetchActiveNudge = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/nudges?active=true&timezone=${encodeURIComponent(tz)}`);
      if (!res.ok) return;

      const nudges: NudgeData[] = await res.json();
      if (nudges.length > 0) {
        setNudge(nudges[0]);
        // Delayed entrance for smooth animation
        requestAnimationFrame(() => setIsVisible(true));
      } else {
        setNudge(null);
        setIsVisible(false);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchActiveNudge();
    const interval = setInterval(fetchActiveNudge, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchActiveNudge]);

  const handleDismiss = async () => {
    if (!nudge || isDismissing) return;
    setIsDismissing(true);
    setIsVisible(false);

    try {
      await fetch(`/api/nudges/${nudge._id}/dismiss`, { method: "PATCH" });
    } catch {
      // Best effort
    }

    setTimeout(() => {
      setNudge(null);
      setIsDismissing(false);
    }, 400);
  };

  if (!nudge) return null;

  const accent = TIER_ACCENTS[nudge.tier] || TIER_ACCENTS.core;

  return (
    <div
      className="friction-banner"
      style={{
        position: "relative",
        zIndex: 52,
        padding: "0.75rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: `linear-gradient(135deg, color-mix(in oklch, ${accent} 12%, var(--v2-surface)) 0%, color-mix(in oklch, ${accent} 6%, var(--v2-surface)) 100%)`,
        borderBottom: `1px solid color-mix(in oklch, ${accent} 25%, transparent)`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
        overflow: "hidden",
      }}
    >
      {/* Glow accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0.6,
        }}
      />

      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: "2rem",
          height: "2rem",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `color-mix(in oklch, ${accent} 15%, transparent)`,
          border: `1px solid color-mix(in oklch, ${accent} 20%, transparent)`,
        }}
      >
        <Flame style={{ width: "1rem", height: "1rem", color: accent }} />
      </div>

      {/* Message */}
      <p
        style={{
          flex: 1,
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          color: "var(--world-text-primary, oklch(0.85 0.01 260))",
          margin: 0,
          fontFamily: "var(--font-body)",
        }}
      >
        {nudge.message}
      </p>

      {/* CTA Button */}
      <a
        href={nudge.ctaUrl}
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.75rem",
          borderRadius: "0.5rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          color: "oklch(0.15 0 0)",
          background: accent,
          textDecoration: "none",
          transition: "filter 0.2s ease",
          whiteSpace: "nowrap",
        }}
      >
        {nudge.ctaLabel}
        <ArrowRight style={{ width: "0.75rem", height: "0.75rem" }} />
      </a>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        disabled={isDismissing}
        style={{
          flexShrink: 0,
          width: "1.5rem",
          height: "1.5rem",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "1px solid color-mix(in oklch, var(--v2-text-muted) 20%, transparent)",
          cursor: "pointer",
          color: "var(--v2-text-muted)",
          transition: "background 0.2s ease, color 0.2s ease",
          padding: 0,
        }}
        aria-label="Dismiss notification"
      >
        <X style={{ width: "0.75rem", height: "0.75rem" }} />
      </button>
    </div>
  );
}
