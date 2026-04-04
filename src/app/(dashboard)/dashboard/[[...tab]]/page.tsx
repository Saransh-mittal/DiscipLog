"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Clock, TrendingUp } from "lucide-react";
import { useMomentum } from "@/components/MomentumProvider";
import { useLogs } from "@/components/LogsProvider";
import { useActiveTab, type DashboardTab } from "@/components/DashboardNav";
import { useWorld } from "@/components/worlds/WorldRenderer";
import CalendarV2 from "@/components/CalendarV2";
import WeeklyProgressV2 from "@/components/WeeklyProgressV2";
import AIChatDrawer from "@/components/AIChatDrawer";
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
import RecallBonusCard from "@/components/RecallBonusCard";

const ALL_TABS: DashboardTab[] = ["overview", "log", "history", "recall", "settings", "archive"];

/** Stat cards that get the same CardSkin treatment as MomentumFlame */
function StatCards() {
  const { todayHours, weeklyHours, loading: momentumLoading } = useMomentum();
  const { CardSkin, theme } = useWorld();
  const isLoading = momentumLoading;

  const stats = [
    { label: "Today", value: `${todayHours.toFixed(2)}h`, icon: Clock, accent: todayHours >= 4 },
    { label: "This Week", value: `${weeklyHours.toFixed(2)}h`, icon: TrendingUp, accent: weeklyHours >= 20 },
  ];

  return (
    <>
      {stats.map((stat) => (
        <CardSkin
          key={stat.label}
          className="flex items-center gap-4"
          style={{ padding: "1rem 1.25rem" }}
        >
          <div
            className="rounded-xl p-2.5"
            style={{
              background: stat.accent
                ? `color-mix(in oklch, ${theme.accent} 12%, transparent)`
                : theme.surfaceRaised,
            }}
          >
            <stat.icon
              className="h-5 w-5"
              style={{
                color: stat.accent
                  ? theme.accent
                  : theme.textMuted,
              }}
            />
          </div>
          <div>
            <p
              className="mb-0.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: theme.textMuted }}
            >
              {stat.label}
            </p>
            <p
              className="text-2xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: stat.accent
                  ? theme.accent
                  : theme.textPrimary,
              }}
            >
              {isLoading ? "—" : stat.value}
            </p>
          </div>
        </CardSkin>
      ))}
    </>
  );
}

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
  const { loading: momentumLoading } = useMomentum();
  const { logs, loading, refreshLogs } = useLogs();
  const { data: session } = useSession();
  const isPro = (session?.user as any)?.plan === "pro";

  const [backgroundTabsMounted, setBackgroundTabsMounted] = useState(false);

  // After initial paint, mount remaining tabs in background
  useEffect(() => {
    const id = setTimeout(() => {
      setBackgroundTabsMounted(true);
    }, 50);
    return () => clearTimeout(id);
  }, []);

  const mountedTabs = useMemo(
    () =>
      backgroundTabsMounted ? new Set(ALL_TABS) : new Set<DashboardTab>([activeTab]),
    [activeTab, backgroundTabsMounted]
  );

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
                <span className="inline-flex items-center gap-2.5">
                  Overview
                  {isPro && (
                    <span
                      className="relative overflow-hidden inline-flex items-center"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.68 0.19 60), oklch(0.58 0.18 50))",
                        color: "oklch(0.13 0.01 60)",
                        fontWeight: 700,
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        padding: "2px 7px",
                        borderRadius: "5px",
                        lineHeight: 1.4,
                        verticalAlign: "middle",
                      }}
                    >
                      PRO
                    </span>
                  )}
                </span>
              </h1>
              <p
                className="max-w-xl text-base leading-relaxed"
                style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
              >
                Your discipline at a glance.
              </p>
            </section>

            {/* Stats Row — Today, This Week, Streak */}
            <div className="grid gap-4 md:grid-cols-3">
              <StatCards />
              <MomentumFlame />
            </div>

            {/* Recall Bonus — full width, premium accent line */}
            <RecallBonusCard />

            <DailyProgressV2 />
            <CommitmentTracker />
            <WeeklyProgressV2 />
            <CalendarV2 logs={logs} loading={loading} />
            <EndOfDayMicroReview />
          </div>
        </div>
      )}

      {/* ── Log ── */}
      {mountedTabs.has("log") && (
        <div style={{ display: activeTab === "log" ? "block" : "none" }}>
          <div className="log-page-stack">
            <SprintTimerCard onLogSaved={refreshLogs} />
            <LoggerV2 onLogSaved={refreshLogs} />
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
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--world-text-primary, var(--v2-text-primary))",
                }}
              >
                History
              </h1>
              <p
                className="max-w-xl text-base leading-relaxed"
                style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}
              >
                Your complete record of focus blocks and sprints.
              </p>
            </section>

            <LogHistoryV2 logs={logs} loading={loading} refreshLogs={refreshLogs} />
          </div>
        </div>
      )}

      {/* ── Recall ── */}
      {mountedTabs.has("recall") && (
        <div style={{ display: activeTab === "recall" ? "block" : "none" }}>
          <div className="space-y-8">
            <SmartRecallFeed />
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
      {/* ── AI Coach Drawer (always mounted, single instance) ── */}
      <AIChatDrawer mode={{ type: "coach" }} />
    </>
  );
}
