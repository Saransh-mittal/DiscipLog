"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Clock, TrendingUp } from "lucide-react";
import { useMomentum } from "@/components/MomentumProvider";
import { useLogs } from "@/components/LogsProvider";
import { useActiveTab, type DashboardTab } from "@/components/DashboardNav";
import CalendarV2 from "@/components/CalendarV2";
import WeeklyProgressV2 from "@/components/WeeklyProgressV2";
import AIAssistantV2 from "@/components/AIAssistantV2";
import DailyProgressV2 from "@/components/DailyProgressV2";
import CommitmentTracker from "@/components/CommitmentTracker";
import MomentumFlame from "@/components/MomentumFlame";
import LoggerV2 from "@/components/LoggerV2";
import SprintTimerCard from "@/components/SprintTimerCard";
import LogHistoryV2 from "@/components/LogHistoryV2";
import SettingsPage from "@/components/SettingsPage";
import SmartRecallFeed from "@/components/SmartRecallFeed";
import EndOfDayMicroReview from "@/components/EndOfDayMicroReview";
import DebriefArchive from "@/components/DebriefArchive";

const ALL_TABS: DashboardTab[] = ["overview", "log", "history", "recall", "settings", "archive"];

/**
 * Progressive tab mounting strategy:
 * 1. The active tab renders immediately on first paint
 * 2. After the active tab is interactive (~50ms), remaining tabs mount in background
 * 3. Once mounted, all tabs stay mounted forever with display:none
 *
 * Result: fast initial load + instant tab switching
 */
export default function DashboardTabPage() {
  const { activeTab } = useActiveTab();
  const { todayHours, weeklyHours, loading: momentumLoading } = useMomentum();
  const { logs, loading, refreshLogs } = useLogs();
  const isLoading = loading || momentumLoading;

  // Track which tabs have been mounted
  const [mountedTabs, setMountedTabs] = useState<Set<DashboardTab>>(
    () => new Set([activeTab])
  );

  // When user clicks a tab, mount it immediately
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // After initial paint, mount remaining tabs in background
  useEffect(() => {
    const id = setTimeout(() => {
      setMountedTabs(new Set(ALL_TABS));
    }, 50);
    return () => clearTimeout(id);
  }, []);

  const stats = [
    { label: "Today", value: `${todayHours.toFixed(2)}h`, icon: Clock, accent: todayHours >= 4 },
    { label: "This Week", value: `${weeklyHours.toFixed(2)}h`, icon: TrendingUp, accent: weeklyHours >= 20 },
  ];

  return (
    <>
      {/* ── Overview ── */}
      {mountedTabs.has("overview") && (
        <div style={{ display: activeTab === "overview" ? "block" : "none" }}>
          <div className="space-y-8">
            <section>
              <h1
                className="mb-2 text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--world-text-primary, var(--v2-text-primary))",
                }}
              >
                Overview
              </h1>
              <p
                className="max-w-xl text-base leading-relaxed"
                style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
              >
                Your discipline at a glance.
              </p>
            </section>

            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat) => (
                <Card
                  key={stat.label}
                  className="world-card relative flex items-center gap-4 overflow-hidden border p-4 md:p-5"
                >
                  <div
                    className="rounded-xl p-2.5"
                    style={{
                      background: stat.accent
                        ? "oklch(0.65 0.19 60 / 10%)"
                        : "var(--world-surface-raised, var(--v2-surface-raised))",
                    }}
                  >
                    <stat.icon
                      className="h-5 w-5"
                      style={{
                        color: stat.accent
                          ? "var(--world-accent, var(--v2-amber-400))"
                          : "var(--world-text-muted, var(--v2-text-muted))",
                      }}
                    />
                  </div>
                  <div>
                    <p
                      className="mb-0.5 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}
                    >
                      {stat.label}
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: stat.accent
                          ? "var(--world-accent, var(--v2-amber-400))"
                          : "var(--world-text-primary, var(--v2-text-primary))",
                      }}
                    >
                      {isLoading ? "—" : stat.value}
                    </p>
                  </div>
                </Card>
              ))}

              <MomentumFlame />
            </div>

            <DailyProgressV2 />
            <CommitmentTracker />
            <WeeklyProgressV2 />
            <CalendarV2 logs={logs} loading={loading} />
            <EndOfDayMicroReview />
            <AIAssistantV2 logs={logs} />
          </div>
        </div>
      )}

      {/* ── Log ── */}
      {mountedTabs.has("log") && (
        <div style={{ display: activeTab === "log" ? "block" : "none" }}>
          <div className="log-page-stack">
            <SprintTimerCard onLogSaved={refreshLogs} />
            <LoggerV2 onLogSaved={refreshLogs} />
            <AIAssistantV2 logs={logs} />
          </div>
        </div>
      )}

      {/* ── History ── */}
      {mountedTabs.has("history") && (
        <div style={{ display: activeTab === "history" ? "block" : "none" }}>
          <div className="space-y-8">
            <section>
              <h1
                className="mb-2 text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                History
              </h1>
              <p
                className="max-w-xl text-base leading-relaxed"
                style={{ color: "var(--v2-text-secondary)" }}
              >
                Your complete record of focus blocks and sprints.
              </p>
            </section>

            <LogHistoryV2 logs={logs} loading={loading} refreshLogs={refreshLogs} />
            <AIAssistantV2 logs={logs} />
          </div>
        </div>
      )}

      {/* ── Recall ── */}
      {mountedTabs.has("recall") && (
        <div style={{ display: activeTab === "recall" ? "block" : "none" }}>
          <div className="space-y-8">
            <SmartRecallFeed />
            <AIAssistantV2 logs={logs} />
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      {mountedTabs.has("settings") && (
        <div style={{ display: activeTab === "settings" ? "block" : "none" }}>
          <SettingsPage />
        </div>
      )}

      {/* ── Archive ── */}
      {mountedTabs.has("archive") && (
        <div style={{ display: activeTab === "archive" ? "block" : "none" }}>
          <DebriefArchive />
        </div>
      )}
    </>
  );
}
