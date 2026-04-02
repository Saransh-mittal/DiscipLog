"use client";

import { useState, useEffect, useCallback } from "react";
import { useDebriefs, type DebriefData } from "@/components/DebriefsProvider";
import {
  X,
  Trophy,
  Flame,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ArrowRight,
} from "lucide-react";

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} \u2013 ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function formatDay(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function TrendArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.25) {
    return <Minus style={{ width: "0.75rem", height: "0.75rem", color: "var(--world-text-muted)" }} />;
  }
  if (diff > 0) {
    return <TrendingUp style={{ width: "0.75rem", height: "0.75rem", color: "var(--v2-sage-400, oklch(0.72 0.12 155))" }} />;
  }
  return <TrendingDown style={{ width: "0.75rem", height: "0.75rem", color: "var(--v2-rose-400, oklch(0.70 0.18 20))" }} />;
}

export default function WeeklyDebriefModal() {
  const { latestDebrief, acknowledgeDebrief } = useDebriefs();
  const [debrief, setDebrief] = useState<DebriefData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  useEffect(() => {
    if (!latestDebrief) return;

    setDebrief((current) => (current?._id === latestDebrief._id ? current : latestDebrief));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
  }, [latestDebrief]);

  const handleAcknowledge = useCallback(async () => {
    if (!debrief || isAcknowledging) return;
    setIsAcknowledging(true);

    try {
      await acknowledgeDebrief(debrief._id);
      setIsVisible(false);
      setTimeout(() => {
        setDebrief((current) => (current?._id === debrief._id ? null : current));
      }, 600);
    } catch {
      // Best effort
    } finally {
      setIsAcknowledging(false);
    }
  }, [acknowledgeDebrief, debrief, isAcknowledging]);

  if (!debrief) return null;

  const maxCatHours = Math.max(...debrief.categoryBreakdown.map((c) => c.hours), 1);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "oklch(0 0 0 / 70%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.6s ease",
        padding: "1rem",
      }}
    >
      <div
        className="world-card"
        style={{
          width: "100%",
          maxWidth: "40rem",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 4rem)",
          position: "relative",
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(1rem) scale(0.98)",
          opacity: isVisible ? 1 : 0,
          transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
          padding: 0, // Reset padding because we use internal areas
          overflow: "hidden",
        }}
      >
        {/* Sticky Header Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "1.25rem 1.25rem 0" }}>
          <button
            onClick={handleAcknowledge}
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--world-surface-raised)",
              border: "1px solid var(--world-border)",
              cursor: "pointer",
              color: "var(--world-text-secondary)",
              padding: 0,
              transition: "transform 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--world-text-primary)";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--world-text-secondary)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <X style={{ width: "1rem", height: "1rem" }} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            padding: "0 2.5rem 2.5rem 2.5rem",
            overflowY: "auto",
            flex: 1,
            // Custom scrollbar could be applied here via a class or pseudo-elements
            scrollbarWidth: "thin",
          }}
        >
          {/* Internal gradient line for styled top border effect */}
          <div className="world-accent-line" style={{ position: "absolute", top: 0, left: 0, height: "2px", width: "100%" }} />

          {/* Date range */}
          <p
            className="v2-stagger-in v2-stagger-1"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-body)",
              color: "var(--world-text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "0 0 0.75rem",
            }}
          >
            {formatDateRange(debrief.weekStartDate, debrief.weekEndDate)}
          </p>

          {/* Week Title */}
          <h1
            className="v2-stagger-in v2-stagger-2"
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--world-text-primary)",
              margin: "0 0 2rem",
              lineHeight: 1.15,
            }}
          >
            {debrief.weekTitle}
          </h1>

          {/* Stats Grid */}
          <div
            className="v2-stagger-in v2-stagger-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
              marginBottom: "1.75rem",
            }}
          >
            {/* Total Hours */}
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Total Hours</span>
              <span style={statValueStyle}>{debrief.totalHours}</span>
              <span style={statSubStyle}>{debrief.totalLogs} sessions</span>
            </div>

            {/* Best Day */}
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Best Day</span>
              <span style={statValueStyle}>
                {debrief.bestDay.hours}h
                <Flame style={{ width: "1rem", height: "1rem", color: "var(--world-accent)", marginLeft: "0.25rem", verticalAlign: "middle" }} />
              </span>
              <span style={statSubStyle}>{formatDay(debrief.bestDay.date)}</span>
            </div>

            {/* Consistency */}
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Consistency</span>
              <span style={statValueStyle}>{debrief.consistencyPercent}%</span>
              <span style={statSubStyle}>of 7 days</span>
            </div>
          </div>

          {/* MVP Category Badge */}
          {debrief.mvpCategory && (
            <div
              className="v2-stagger-in v2-stagger-4"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "2rem",
                background: "var(--world-surface-raised)",
                border: "1px solid var(--world-border)",
                marginBottom: "1.5rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                color: "var(--world-accent)",
                boxShadow: "0 0 12px var(--world-accent-glow)",
              }}
            >
              <Trophy style={{ width: "0.875rem", height: "0.875rem" }} />
              MVP: {debrief.mvpCategory}
            </div>
          )}

          {/* Coach's Note */}
          <div
            className="v2-stagger-in v2-stagger-5"
            style={{
              padding: "1.25rem",
              borderLeft: "3px solid var(--world-accent)",
              background: "var(--world-surface-raised)",
              borderRadius: "0 0.75rem 0.75rem 0",
              marginBottom: "1.5rem",
              boxShadow: "inset 1px 0 0 0 var(--world-accent-glow)",
            }}
          >
            <p
              style={{
                fontSize: "0.9375rem",
                lineHeight: 1.6,
                color: "var(--world-text-primary)",
                fontFamily: "var(--font-body)",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {debrief.coachNote}
            </p>
          </div>

          {/* Hardest Day */}
          {debrief.hardestDay && (
            <p
              className="v2-stagger-in v2-stagger-5"
              style={{
                fontSize: "0.8125rem",
                color: "var(--world-text-muted)",
                fontStyle: "italic",
                marginBottom: "2rem",
                lineHeight: 1.6,
              }}
            >
              {debrief.hardestDay}
            </p>
          )}

          {/* Category Breakdown */}
          {debrief.categoryBreakdown.length > 0 && (
            <div className="v2-stagger-in v2-stagger-5" style={{ marginBottom: "2rem" }}>
              <h3
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-display)",
                  color: "var(--world-text-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "1rem",
                }}
              >
                Category Breakdown
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {debrief.categoryBreakdown.map((cat) => (
                  <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span
                      style={{
                        width: "5rem",
                        fontSize: "0.75rem",
                        color: "var(--world-text-secondary)",
                        fontFamily: "var(--font-body)",
                        flexShrink: 0,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cat.name}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: "0.375rem",
                        borderRadius: "1rem",
                        background: "var(--world-surface-raised)",
                        overflow: "hidden",
                        border: "1px solid var(--world-border)",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min((cat.hours / maxCatHours) * 100, 100)}%`,
                          borderRadius: "1rem",
                          background: "linear-gradient(90deg, var(--world-accent), var(--world-accent))",
                          transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1), background 800ms ease",
                          boxShadow: cat.targetHit ? "0 0 12px var(--world-accent-glow)" : "none",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--world-text-primary)",
                        fontFamily: "var(--font-display)",
                        width: "2.5rem",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {cat.hours}h
                    </span>
                    <TrendArrow current={cat.hours} previous={cat.prevWeekHours} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Challenge for Next Week */}
          {debrief.challengeForNextWeek && (
            <div
              className="v2-stagger-in v2-stagger-5"
              style={{
                padding: "1rem 1.25rem",
                borderRadius: "var(--world-border-radius, 0.75rem)",
                background: "var(--world-surface-raised)",
                border: "1px dashed var(--world-border)",
                marginBottom: "2rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <Target
                style={{
                  width: "1.125rem",
                  height: "1.125rem",
                  color: "var(--world-accent)",
                  flexShrink: 0,
                  marginTop: "0.125rem",
                }}
              />
              <div>
                <p
                  style={{
                    fontSize: "0.6875rem",
                    fontFamily: "var(--font-display)",
                    color: "var(--world-text-secondary)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    margin: "0 0 0.375rem",
                  }}
                >
                  Next Week{"'"}s Challenge
                </p>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--world-text-primary)",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {debrief.challengeForNextWeek}
                </p>
              </div>
            </div>
          )}

          {/* Acknowledge Button */}
          <button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="v2-glow-btn v2-stagger-in v2-stagger-5"
            style={{
              width: "100%",
              padding: "0.875rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--world-accent-glow)",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--world-bg)", 
              background: "var(--world-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "filter 0.2s ease, transform 0.1s ease",
            }}
          >
            <Sparkles style={{ width: "1rem", height: "1rem" }} />
            {isAcknowledging ? "Starting New Week..." : "Acknowledge & Start New Week"}
            {!isAcknowledging && <ArrowRight style={{ width: "1rem", height: "1rem" }} />}
          </button>
        </div>
      </div>
    </div>
  );
}

const statCardStyle: React.CSSProperties = {
  padding: "1rem 0.5rem",
  borderRadius: "0.75rem",
  background: "var(--world-surface-raised)",
  border: "1px solid var(--world-border)",
  textAlign: "center" as const,
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.25rem",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  fontFamily: "var(--font-display)",
  color: "var(--world-text-muted)",
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

const statValueStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  color: "var(--world-text-primary)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const statSubStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--world-text-secondary)",
  fontFamily: "var(--font-body)",
};
