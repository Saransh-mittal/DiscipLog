"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Hammer, GraduationCap, Rocket } from "lucide-react";
import { DashboardLog, formatLocalDate } from "@/lib/logs";

interface DailyProgressV2Props {
  logs: DashboardLog[];
  loading: boolean;
}

const DAILY_TARGETS = [
  {
    category: "Interview Prep",
    target: 3, // ~18h / 6 working days
    icon: BookOpen,
  },
  {
    category: "Building",
    target: 2, // ~12h / 6 working days
    icon: Hammer,
  },
  {
    category: "Learning",
    target: 1, // ~7h / 7 days
    icon: GraduationCap,
  },
  {
    category: "Shipping",
    target: 0, // No strict target
    icon: Rocket,
  },
];

export default function DailyProgressV2({ logs, loading }: DailyProgressV2Props) {
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
              {loading ? "—" : `${totalToday}h`}
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DAILY_TARGETS.map((cat) => {
            const logged = todayByCategory[cat.category] || 0;
            const isShipping = cat.category === "Shipping";
            const percentage = isShipping
              ? logged > 0 ? 100 : 0
              : cat.target > 0 ? Math.min((logged / cat.target) * 100, 100) : 0;
            const isDone = isShipping ? logged > 0 : logged >= cat.target;

            return (
              <div
                key={cat.category}
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
                  <cat.icon
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
                    {cat.category}
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
                    {loading ? "—" : logged}
                  </span>
                  {!isShipping && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--v2-text-muted)" }}
                    >
                      / {cat.target}h
                    </span>
                  )}
                  {isShipping && logged > 0 && (
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
                      width: loading ? "0%" : `${percentage}%`,
                      background: isShipping
                        ? "var(--v2-sage-400)"
                        : isDone
                          ? "var(--v2-amber-400)"
                          : "linear-gradient(90deg, var(--v2-amber-600), var(--v2-amber-400))",
                      transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>

                {/* Badge */}
                {!loading && isDone && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-[9px] px-1.5 py-0 border"
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
                    {isShipping ? "Shipped!" : "Done!"}
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
