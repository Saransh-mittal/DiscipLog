"use client";

import { useMemo } from "react";
import { format, subWeeks, eachDayOfInterval, startOfWeek, addDays } from "date-fns";
import WorldCard from "@/components/WorldCard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DashboardLog } from "@/lib/logs";

interface CalendarV2Props {
  logs: DashboardLog[];
  loading: boolean;
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const WEEKS_TO_SHOW = 12;

function getIntensity(hours: number): number {
  if (hours === 0) return 0;
  if (hours < 2) return 1;
  if (hours < 4) return 2;
  if (hours < 6) return 3;
  if (hours < 8) return 4;
  return 5;
}

const INTENSITY_STYLES: Record<number, { bg: string; border: string }> = {
  0: {
    bg: "var(--world-surface-raised, var(--v2-surface-raised))",
    border: "var(--world-border, var(--v2-border))",
  },
  1: {
    bg: "color-mix(in oklch, var(--world-accent) 10%, transparent)",
    border: "color-mix(in oklch, var(--world-accent) 15%, transparent)",
  },
  2: {
    bg: "color-mix(in oklch, var(--world-accent) 22%, transparent)",
    border: "color-mix(in oklch, var(--world-accent) 28%, transparent)",
  },
  3: {
    bg: "color-mix(in oklch, var(--world-accent) 38%, transparent)",
    border: "color-mix(in oklch, var(--world-accent) 42%, transparent)",
  },
  4: {
    bg: "color-mix(in oklch, var(--world-accent) 55%, transparent)",
    border: "color-mix(in oklch, var(--world-accent) 60%, transparent)",
  },
  5: {
    bg: "var(--world-accent, var(--v2-amber-400))",
    border: "color-mix(in oklch, var(--world-accent) 90%, white)",
  },
};

export default function CalendarV2({ logs, loading }: CalendarV2Props) {
  // Compute daily totals
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    logs.forEach((log) => {
      totals[log.date] = (totals[log.date] || 0) + log.hours;
    });
    return totals;
  }, [logs]);

  // Build grid: 12 weeks × 7 days
  const today = new Date();
  const gridStart = startOfWeek(subWeeks(today, WEEKS_TO_SHOW - 1), {
    weekStartsOn: 1,
  });

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      const weekStart = addDays(gridStart, w * 7);
      const weekDays = eachDayOfInterval({
        start: weekStart,
        end: addDays(weekStart, 6),
      });
      result.push(weekDays);
    }
    return result;
  }, [gridStart]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, colIdx) => {
      const firstDay = week[0];
      const month = firstDay.getMonth();
      if (month !== lastMonth) {
        labels.push({ label: format(firstDay, "MMM"), col: colIdx });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  // Summary stats
  const totalHours = Object.values(dailyTotals).reduce(
    (sum, h) => sum + h,
    0
  );
  const activeDays = Object.keys(dailyTotals).length;

  return (
    <WorldCard
      className="relative overflow-hidden h-full flex flex-col"
      style={{ padding: 0 }}
    >
      {/* Top accent */}
      <div
        className="h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--world-accent, var(--v2-amber-500)), color-mix(in oklch, var(--world-accent, var(--v2-amber-300)) 80%, white), var(--world-accent, var(--v2-amber-500)))",
        }}
      />

      <div className="p-6 md:p-8 flex flex-col flex-1">
        {/* Header */}
        <h3
          className="text-lg font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Discipline History
        </h3>

        {loading ? (
          <div
            className="flex-1 flex items-center justify-center text-sm"
            style={{
              color: "var(--world-text-muted, var(--v2-text-muted))",
              fontFamily: "var(--font-body)",
            }}
          >
            Loading metrics...
          </div>
        ) : (
          <>
            {/* Month labels */}
            <div className="flex mb-2 ml-9">
              {(() => {
                const cells: React.ReactNode[] = [];
                let labelIdx = 0;
                for (let w = 0; w < WEEKS_TO_SHOW; w++) {
                  if (
                    labelIdx < monthLabels.length &&
                    monthLabels[labelIdx].col === w
                  ) {
                    cells.push(
                      <div
                        key={`month-${w}`}
                        className="text-[10px] font-semibold"
                        style={{
                          width: "14px",
                          marginRight: "3px",
                          color: "var(--world-text-muted, var(--v2-text-muted))",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {monthLabels[labelIdx].label}
                      </div>
                    );
                    labelIdx++;
                  } else {
                    cells.push(
                      <div
                        key={`blank-${w}`}
                        style={{ width: "14px", marginRight: "3px" }}
                      />
                    );
                  }
                }
                return cells;
              })()}
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-0">
              {/* Day labels */}
              <div className="flex flex-col gap-[3px] mr-2">
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="text-[10px] font-medium flex items-center justify-end"
                    style={{
                      height: "14px",
                      width: "24px",
                      color: "var(--world-text-muted, var(--v2-obsidian-300))",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid cells */}
              <div className="flex gap-[3px]">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {week.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const hours = dailyTotals[dateStr] || 0;
                      const intensity = getIntensity(hours);
                      const styles = INTENSITY_STYLES[intensity];
                      const isFuture = day > today;

                      return (
                        <Tooltip key={dateStr}>
                          <TooltipTrigger asChild>
                            <div
                              className="rounded-sm transition-all duration-200 hover:scale-125 hover:z-10 cursor-default border"
                              style={{
                                width: "14px",
                                height: "14px",
                                background: isFuture
                                  ? "transparent"
                                  : styles.bg,
                                borderColor: isFuture
                                  ? "var(--world-border, var(--v2-border))"
                                  : styles.border,
                                opacity: isFuture ? 0.3 : 1,
                                boxShadow:
                                  intensity === 5
                                    ? "0 0 8px var(--world-accent-glow, oklch(0.65 0.19 60 / 30%))"
                                    : "none",
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            className="text-xs border px-3 py-2"
                            style={{
                              background: "var(--world-surface, var(--v2-obsidian-600))",
                              borderColor: "var(--world-border, var(--v2-border-strong))",
                              color: "var(--world-text-primary, var(--v2-text-primary))",
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            <span className="font-bold" style={{ color: "var(--world-accent, var(--v2-amber-300))" }}>
                              {hours}h
                            </span>{" "}
                            on {format(day, "MMM d, yyyy")}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend + stats */}
            <div
              className="mt-6 pt-5 border-t flex items-center justify-between flex-wrap gap-4"
              style={{ borderColor: "var(--world-border, var(--v2-border))" }}
            >
              {/* Legend */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: "var(--world-text-muted, var(--v2-text-muted))",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Less
                </span>
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className="rounded-sm border"
                    style={{
                      width: "12px",
                      height: "12px",
                      background: INTENSITY_STYLES[level].bg,
                      borderColor: INTENSITY_STYLES[level].border,
                    }}
                  />
                ))}
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: "var(--world-text-muted, var(--v2-text-muted))",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  More
                </span>
              </div>

              {/* Stats */}
              <div
                className="flex items-center gap-4 text-[11px] font-semibold"
                style={{
                  color: "var(--world-text-muted, var(--v2-text-muted))",
                  fontFamily: "var(--font-body)",
                }}
              >
                <span>
                  <span style={{ color: "var(--world-accent, var(--v2-amber-300))" }}>
                    {totalHours.toFixed(2)}
                  </span>{" "}
                  total hours
                </span>
                <span>
                  <span style={{ color: "var(--world-accent, var(--v2-amber-300))" }}>
                    {activeDays}
                  </span>{" "}
                  active days
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </WorldCard>
  );
}
