"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Clock, Flame, TrendingUp } from "lucide-react";
import { DashboardLog, formatLocalDate, sortLogsByTimestamp } from "@/lib/logs";

const CalendarV2 = dynamic(() => import("@/components/CalendarV2"), { ssr: false });
const WeeklyProgressV2 = dynamic(() => import("@/components/WeeklyProgressV2"), { ssr: false });
const AIAssistantV2 = dynamic(() => import("@/components/AIAssistantV2"), { ssr: false });
const DailyProgressV2 = dynamic(() => import("@/components/DailyProgressV2"), { ssr: false });

export default function DashboardPage() {
  const [logs, setLogs] = useState<DashboardLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logs")
      .then((res) => res.json())
      .then((data) => {
        setLogs(sortLogsByTimestamp(data || []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const today = formatLocalDate(new Date());
  const todayHours = logs
    .filter((log) => log.date === today)
    .reduce((sum, log) => sum + log.hours, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekThreshold = formatLocalDate(sevenDaysAgo);
  const weeklyHours = logs
    .filter((log) => log.date >= weekThreshold)
    .reduce((sum, log) => sum + log.hours, 0);

  const computeStreak = () => {
    const dailyTotals: Record<string, number> = {};
    logs.forEach((log) => {
      dailyTotals[log.date] = (dailyTotals[log.date] || 0) + log.hours;
    });

    let streak = 0;
    const date = new Date();
    const todayStr = formatLocalDate(date);
    if (!dailyTotals[todayStr] || dailyTotals[todayStr] < 1) {
      date.setDate(date.getDate() - 1);
    }

    while (true) {
      const dateStr = formatLocalDate(date);
      if (dailyTotals[dateStr] && dailyTotals[dateStr] >= 1) {
        streak++;
        date.setDate(date.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const streak = loading ? 0 : computeStreak();

  const stats = [
    { label: "Today", value: `${todayHours}h`, icon: Clock, accent: todayHours >= 8 },
    { label: "Streak", value: `${streak}d`, icon: Flame, accent: streak >= 3 },
    { label: "This Week", value: `${weeklyHours}h`, icon: TrendingUp, accent: weeklyHours >= 40 },
  ];

  return (
    <div className="space-y-8">
      <section className="v2-stagger-in v2-stagger-1">
        <h1
          className="mb-2 text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Overview
        </h1>
        <p
          className="max-w-xl text-base leading-relaxed"
          style={{ color: "var(--v2-text-secondary)" }}
        >
          Your discipline at a glance. 
        </p>
      </section>

      <div className="v2-stagger-in v2-stagger-2 grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="relative flex items-center gap-4 overflow-hidden border p-4 md:p-5"
            style={{
              background: "var(--v2-surface)",
              borderColor: stat.accent
                ? "oklch(0.65 0.19 60 / 20%)"
                : "var(--v2-border)",
            }}
          >
            <div
              className="rounded-xl p-2.5"
              style={{
                background: stat.accent
                  ? "oklch(0.65 0.19 60 / 10%)"
                  : "var(--v2-surface-raised)",
              }}
            >
              <stat.icon
                className="h-5 w-5"
                style={{
                  color: stat.accent
                    ? "var(--v2-amber-400)"
                    : "var(--v2-text-muted)",
                }}
              />
            </div>
            <div>
              <p
                className="mb-0.5 text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--v2-text-muted)" }}
              >
                {stat.label}
              </p>
              <p
                className="text-2xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: stat.accent
                    ? "var(--v2-amber-400)"
                    : "var(--v2-text-primary)",
                }}
              >
                {loading ? "—" : stat.value}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="v2-stagger-in v2-stagger-3">
        <DailyProgressV2 logs={logs} loading={loading} />
      </div>

      <div className="v2-stagger-in v2-stagger-4">
        <WeeklyProgressV2 logs={logs} loading={loading} />
      </div>

      <div className="v2-stagger-in v2-stagger-5">
        <CalendarV2 logs={logs} loading={loading} />
      </div>

      <AIAssistantV2 logs={logs} />
    </div>
  );
}
