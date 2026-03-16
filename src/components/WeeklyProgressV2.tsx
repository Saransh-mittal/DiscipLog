"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Hammer,
  GraduationCap,
  Rocket,
} from "lucide-react";
import { DashboardLog, formatLocalDate } from "@/lib/logs";

interface WeeklyProgressV2Props {
  logs: DashboardLog[];
  loading: boolean;
}

const CATEGORY_TARGETS = [
  {
    category: "Interview Prep",
    minTarget: 15,
    maxTarget: 20,
    icon: BookOpen,
    gradient: "linear-gradient(90deg, var(--v2-amber-500), var(--v2-amber-300))",
  },
  {
    category: "Building",
    minTarget: 10,
    maxTarget: 12,
    icon: Hammer,
    gradient: "linear-gradient(90deg, var(--v2-amber-600), var(--v2-amber-400))",
  },
  {
    category: "Learning",
    minTarget: 6,
    maxTarget: 7,
    icon: GraduationCap,
    gradient: "linear-gradient(90deg, var(--v2-amber-500), var(--v2-amber-300))",
  },
  {
    category: "Shipping",
    minTarget: 0,
    maxTarget: 0,
    icon: Rocket,
    gradient: "linear-gradient(90deg, var(--v2-sage-500), var(--v2-sage-400))",
  },
];

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function WeeklyProgressV2({
  logs,
  loading,
}: WeeklyProgressV2Props) {
  const weekStart = useMemo(() => getWeekStart(), []);

  const weeklyByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    const weekStartStr = formatLocalDate(weekStart);

    logs.forEach((log) => {
      if (log.date >= weekStartStr) {
        result[log.category] = (result[log.category] || 0) + log.hours;
      }
    });

    return result;
  }, [logs, weekStart]);

  return (
    <Card
      className="relative overflow-hidden p-0 border"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      <div
        className="h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--v2-amber-500), var(--v2-amber-300), var(--v2-amber-500))",
        }}
      />

      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Weekly Progress
          </h3>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{
              color: "var(--v2-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            This week
          </span>
        </div>

        <div className="space-y-5">
          {CATEGORY_TARGETS.map((cat) => {
            const logged = weeklyByCategory[cat.category] || 0;
            const target = cat.maxTarget || 0;
            const isShipping = cat.category === "Shipping";
            const percentage = isShipping
              ? (logged > 0 ? 100 : 0)
              : Math.min((logged / target) * 100, 100);
            const isOnTrack = isShipping
              ? logged > 0
              : logged >= cat.minTarget;
            const isExceeding = !isShipping && logged >= cat.maxTarget;

            return (
              <div key={cat.category}>
                {/* Label row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-1.5 rounded-lg"
                      style={{
                        background: "var(--v2-surface-overlay)",
                      }}
                    >
                      <cat.icon
                        className="w-3.5 h-3.5"
                        style={{
                          color: isOnTrack
                            ? "var(--v2-amber-400)"
                            : "var(--v2-obsidian-300)",
                        }}
                      />
                    </div>
                    <span
                      className="text-sm font-semibold"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {cat.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: isOnTrack
                          ? "var(--v2-amber-300)"
                          : "var(--v2-text-secondary)",
                      }}
                    >
                      {loading ? "—" : `${logged}h`}
                      {!isShipping && (
                        <span
                          className="font-medium"
                          style={{ color: "var(--v2-text-muted)" }}
                        >
                          {" "}
                          / {cat.minTarget}–{cat.maxTarget}h
                        </span>
                      )}
                    </span>

                    {!loading && isOnTrack && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border"
                        style={{
                          borderColor: isShipping
                            ? "oklch(0.62 0.14 155 / 25%)"
                            : "oklch(0.65 0.19 60 / 25%)",
                          color: isShipping
                            ? "var(--v2-sage-400)"
                            : "var(--v2-amber-400)",
                          background: isShipping
                            ? "oklch(0.62 0.14 155 / 5%)"
                            : "oklch(0.65 0.19 60 / 5%)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {isExceeding ? "Exceeding!" : isShipping ? "Shipped!" : "On Track"}
                      </Badge>
                    )}

                    {!loading && !isOnTrack && !isShipping && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border"
                        style={{
                          borderColor: "oklch(0.60 0.20 18 / 20%)",
                          color: "var(--v2-rose-400)",
                          background: "oklch(0.60 0.20 18 / 5%)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        Behind
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--v2-surface-raised)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: loading ? "0%" : `${percentage}%`,
                      background: cat.gradient,
                      transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                      boxShadow:
                        percentage > 60
                          ? "0 0 12px oklch(0.65 0.19 60 / 25%)"
                          : "none",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
