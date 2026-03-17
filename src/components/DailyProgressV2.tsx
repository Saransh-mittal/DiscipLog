"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon from "@/components/DynamicIcon";
import { DashboardLog, formatLocalDate } from "@/lib/logs";

interface DailyProgressV2Props {
  logs: DashboardLog[];
  loading: boolean;
}

export default function DailyProgressV2({ logs, loading }: DailyProgressV2Props) {
  const { categories, loading: catLoading } = useCategoriesContext();
  const today = useMemo(() => formatLocalDate(new Date()), []);

  const todayByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.date === today) {
        result[log.category] = (result[log.category] || 0) + log.hours;
      }
    });
    return result;
  }, [logs, today]);

  const totalToday = Object.values(todayByCategory).reduce((s, h) => s + h, 0);
  const isLoading = loading || catLoading;

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
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Today&apos;s Breakdown
          </h3>
          <div className="flex items-center gap-2">
            <span
              className="text-2xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: totalToday > 0 ? "var(--v2-amber-300)" : "var(--v2-text-muted)",
              }}
            >
              {isLoading ? "—" : `${totalToday}h`}
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.15em]"
              style={{
                color: "var(--v2-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              logged
            </span>
          </div>
        </div>

        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(categories.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {categories.map((cat) => {
            const logged = todayByCategory[cat.name] || 0;
            const hasTarget = cat.dailyTargetHours > 0;
            const percentage = hasTarget
              ? Math.min((logged / cat.dailyTargetHours) * 100, 100)
              : logged > 0
                ? 100
                : 0;
            const isDone = hasTarget ? logged >= cat.dailyTargetHours : logged > 0;

            return (
              <div
                key={cat.name}
                className="rounded-xl p-4 border transition-colors duration-200"
                style={{
                  background: "var(--v2-surface-raised)",
                  borderColor: isDone
                    ? "oklch(0.65 0.19 60 / 20%)"
                    : "var(--v2-border)",
                }}
              >
                {/* Icon + label */}
                <div className="flex items-center gap-2 mb-3">
                  <DynamicIcon
                    name={cat.icon}
                    className="w-4 h-4"
                    style={{
                      color: isDone
                        ? "var(--v2-amber-400)"
                        : "var(--v2-obsidian-300)",
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold truncate"
                    style={{
                      color: "var(--v2-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {cat.name}
                  </span>
                </div>

                {/* Hours */}
                <div className="flex items-baseline gap-1 mb-2.5">
                  <span
                    className="text-xl font-bold tabular-nums"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: isDone ? "var(--v2-amber-300)" : "var(--v2-text-primary)",
                    }}
                  >
                    {isLoading ? "—" : logged}
                  </span>
                  {hasTarget && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--v2-text-muted)" }}
                    >
                      / {cat.dailyTargetHours}h
                    </span>
                  )}
                  {!hasTarget && logged > 0 && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--v2-sage-400)" }}
                    >
                      h ✓
                    </span>
                  )}
                </div>

                {/* Mini progress bar */}
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--v2-surface-overlay)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: isLoading ? "0%" : `${percentage}%`,
                      background: !hasTarget && logged > 0
                        ? "var(--v2-sage-400)"
                        : isDone
                          ? "var(--v2-amber-400)"
                          : "linear-gradient(90deg, var(--v2-amber-600), var(--v2-amber-400))",
                      transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>

                {/* Badge */}
                {!isLoading && isDone && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-[9px] px-1.5 py-0 border"
                    style={{
                      borderColor: !hasTarget
                        ? "oklch(0.62 0.14 155 / 25%)"
                        : "oklch(0.65 0.19 60 / 25%)",
                      color: !hasTarget
                        ? "var(--v2-sage-400)"
                        : "var(--v2-amber-400)",
                      background: !hasTarget
                        ? "oklch(0.62 0.14 155 / 5%)"
                        : "oklch(0.65 0.19 60 / 5%)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Done!
                  </Badge>
                )}
                {!isLoading && !isDone && cat.isSideCategory && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-[9px] px-1.5 py-0 border"
                    style={{
                      borderColor: "transparent",
                      color: "var(--v2-text-muted)",
                      background: "var(--v2-surface-overlay)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Optional
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
