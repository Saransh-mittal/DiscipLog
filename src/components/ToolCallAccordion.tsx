"use client";

import { useState } from "react";
import { Search, BarChart3, ChevronDown, Zap, Check, AlertTriangle } from "lucide-react";

/* ── Types ── */
export interface ToolCallData {
  key: string;
  toolName: string;
  label: string;
  status: "loading" | "success" | "error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

interface ToolCallAccordionProps {
  steps: ToolCallData[];
}

function renderLoadingToolIcon(toolName: string, statusColor: string) {
  const sharedProps = {
    className: "w-3 h-3",
    style: {
      color: statusColor,
      animation: "dcl-pulse-ring 1.5s ease-in-out infinite",
    },
  };

  if (toolName === "searchHistoricalLogs") {
    return <Search {...sharedProps} />;
  }

  if (toolName === "getCoachStats") {
    return <BarChart3 {...sharedProps} />;
  }

  return <Zap {...sharedProps} />;
}

function getResultSummary(step: ToolCallData): string | null {
  if (step.status !== "success" || !step.output) return null;

  const out = step.output;

  if (typeof out.resultSummary === "string" && out.resultSummary.length > 0) {
    return out.resultSummary;
  }

  // searchHistoricalLogs result
  if (Array.isArray(out.matches)) {
    const count = out.matches.length;
    const cats = Array.isArray(out.resolvedCategories)
      ? (out.resolvedCategories as string[]).join(", ")
      : null;
    let summary = `Found ${count} matching log${count !== 1 ? "s" : ""}`;
    if (cats) summary += ` across ${cats}`;
    return summary;
  }

  // getCoachStats result
  if (out.overview && typeof out.overview === "object") {
    const overview = out.overview as Record<string, unknown>;
    const logs = overview.matchedLogs;
    const hours = overview.matchedHours;
    let summary = "";
    if (typeof logs === "number") summary += `${logs} logs`;
    if (typeof hours === "number") {
      if (summary) summary += ", ";
      summary += `${Math.round((hours as number) * 100) / 100}h`;
    }
    return summary || "Stats loaded";
  }

  return null;
}

function getQuerySummary(step: ToolCallData): string | null {
  if (!step.input) return null;
  const q = step.input.query;
  if (typeof q === "string" && q.length > 0) return q;
  return null;
}

function getStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getDateCoverageSummary(step: ToolCallData): string | null {
  if (!step.output || typeof step.output !== "object") return null;
  const coverage = step.output.dateCoverage;
  if (!coverage || typeof coverage !== "object") return null;

  const record = coverage as Record<string, unknown>;
  const firstDate =
    typeof record.firstDate === "string" ? record.firstDate : null;
  const lastDate =
    typeof record.lastDate === "string" ? record.lastDate : null;
  const activeDays =
    typeof record.activeDays === "number" ? record.activeDays : null;

  if (!firstDate && !lastDate && activeDays === null) {
    return null;
  }

  let summary = "";
  if (firstDate && lastDate) {
    summary = `${firstDate} -> ${lastDate}`;
  } else if (firstDate || lastDate) {
    summary = firstDate || lastDate || "";
  }

  if (activeDays !== null) {
    summary += `${summary ? " " : ""}(${activeDays} active day${
      activeDays === 1 ? "" : "s"
    })`;
  }

  return summary || null;
}

/* ── Accordion Component ── */
export default function ToolCallAccordion({ steps }: ToolCallAccordionProps) {
  if (steps.length === 0) return null;

  return (
    <div className="dcl-tool-accordion" style={{ marginBottom: "0.5em" }}>
      {/* Tool steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {steps.map((step, i) => (
          <ToolStep key={step.key} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

/* ── Individual Tool Step ── */
function ToolStep({ step, index }: { step: ToolCallData; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const query = getQuerySummary(step);
  const result = getResultSummary(step);
  const coverage = getDateCoverageSummary(step);
  const resolvedCategories = getStringList(step.output?.resolvedCategories);
  const advisoryLabels = getStringList(step.output?.advisoryLabels);
  const topicTerms = getStringList(step.output?.topicTerms);
  const intentTags = getStringList(step.output?.intentTags);
  const requestedCategories = getStringList(step.input?.categories);
  const retrievalMode =
    typeof step.output?.retrievalMode === "string"
      ? step.output.retrievalMode
      : typeof step.output?.matchStrategy === "string"
        ? step.output.matchStrategy
      : null;
  const hasDetails =
    Boolean(query) ||
    Boolean(result) ||
    Boolean(coverage) ||
    resolvedCategories.length > 0 ||
    advisoryLabels.length > 0 ||
    topicTerms.length > 0 ||
    intentTags.length > 0 ||
    requestedCategories.length > 0 ||
    Boolean(retrievalMode);

  const statusColor =
    step.status === "loading"
      ? "var(--v2-amber-400)"
      : step.status === "success"
        ? "oklch(0.75 0.14 145)"
        : "oklch(0.70 0.18 20)";
  const shouldGlow = step.status === "success" || step.status === "error";

  return (
    <div
      className={shouldGlow ? "dcl-step-glow" : ""}
      style={{
        position: "relative",
        zIndex: 1,
        borderRadius: "10px",
        background: "oklch(1 0 0 / 3%)",
        border: `1px solid ${
          step.status === "loading"
            ? "oklch(0.65 0.19 60 / 12%)"
            : step.status === "success"
              ? "oklch(0.72 0.16 145 / 12%)"
              : "oklch(0.72 0.18 28 / 14%)"
        }`,
        overflow: "hidden",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        animationDelay: `${index * 0.08}s`,
      }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => hasDetails && setExpanded((prev) => !prev)}
        disabled={!hasDetails}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "7px 10px",
          background: "transparent",
          border: "none",
          cursor: hasDetails ? "pointer" : "default",
          textAlign: "left",
          color: "inherit",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* Status dot / icon */}
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "7px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              step.status === "loading"
                ? "oklch(0.65 0.19 60 / 10%)"
                : step.status === "success"
                  ? "oklch(0.72 0.16 145 / 10%)"
                  : "oklch(0.72 0.18 28 / 10%)",
            flexShrink: 0,
            transition: "background 0.3s ease",
          }}
        >
          {step.status === "loading" ? (
            renderLoadingToolIcon(step.toolName, statusColor)
          ) : step.status === "success" ? (
            <Check className="w-3 h-3" style={{ color: statusColor }} />
          ) : (
            <AlertTriangle
              className="w-3 h-3"
              style={{ color: statusColor }}
            />
          )}
        </div>

        {/* Label */}
        <span
          style={{
            flex: 1,
            fontSize: "11px",
            fontWeight: 500,
            color:
              step.status === "loading"
                ? "oklch(0.75 0.02 70)"
                : "oklch(0.7 0.01 250)",
            letterSpacing: "0.01em",
          }}
        >
          {step.label}
          {step.status === "loading" && (
            <span
              className="dcl-shimmer-bar"
              style={{
                display: "inline-block",
                width: "32px",
                height: "3px",
                borderRadius: "2px",
                marginLeft: "8px",
                verticalAlign: "middle",
              }}
            />
          )}
        </span>

        {/* Chevron */}
        {hasDetails && (
          <ChevronDown
            className="w-3 h-3"
            style={{
              color: "oklch(0.45 0.01 250)",
              transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          />
        )}
      </button>

      {/* Expandable details */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "0 10px 8px 40px",
              fontSize: "10px",
              lineHeight: 1.55,
              color: "oklch(0.55 0.01 250)",
              fontFamily: "var(--font-body)",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            {query && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Query: </span>
                <span style={{ color: "oklch(0.70 0.02 70)", fontStyle: "italic" }}>
                  &quot;{query}&quot;
                </span>
              </div>
            )}
            {result && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Result: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>{result}</span>
              </div>
            )}
            {requestedCategories.length > 0 && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Requested: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>
                  {requestedCategories.join(", ")}
                </span>
              </div>
            )}
            {resolvedCategories.length > 0 && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Resolved: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>
                  {resolvedCategories.join(", ")}
                </span>
              </div>
            )}
            {advisoryLabels.length > 0 && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Advisory: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>
                  {advisoryLabels.join(", ")}
                </span>
              </div>
            )}
            {topicTerms.length > 0 && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Topics: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>
                  {topicTerms.join(", ")}
                </span>
              </div>
            )}
            {intentTags.length > 0 && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Intent: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>
                  {intentTags.join(", ")}
                </span>
              </div>
            )}
            {retrievalMode && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Mode: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>
                  {retrievalMode}
                </span>
              </div>
            )}
            {coverage && (
              <div>
                <span style={{ color: "oklch(0.45 0.01 250)" }}>Coverage: </span>
                <span style={{ color: "oklch(0.70 0.01 250)" }}>{coverage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
