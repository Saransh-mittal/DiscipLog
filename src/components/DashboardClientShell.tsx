"use client";

import { type ReactNode, useEffect } from "react";
import { LogsProvider, useLogs } from "@/components/LogsProvider";
import MomentumProvider from "@/components/MomentumProvider";
import WorldRenderer from "@/components/worlds/WorldRenderer";
import SoundManager from "@/components/SoundManager";
import CompletionCelebration from "@/components/CompletionCelebration";
import WeeklyDebriefModal from "@/components/WeeklyDebriefModal";
import { DebriefsProvider } from "@/components/DebriefsProvider";
import { TabProvider } from "@/components/DashboardNav";
import SmartRecallProvider from "@/components/SmartRecallProvider";

// Suppress known React DevTools instrumentation error (not an app bug)
// https://github.com/facebook/react/issues/24119
if (typeof window !== "undefined") {
  const _origError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
    if (
      msg.includes("The children should not have changed") ||
      msg.includes("React instrumentation encountered an error")
    ) return;
    _origError.apply(console, args);
  };
}

/** Eagerly preload heavy components after initial render. */
function usePreloadComponents() {
  useEffect(() => {
    const timer = setTimeout(() => {
      import("@/components/CalendarV2");
      import("@/components/LogHistoryV2");
      import("@/components/LoggerV2");
      import("@/components/SprintTimerCard");
      import("@/components/CommitmentTracker");
      import("@/components/WeeklyProgressV2");
      import("@/components/DailyProgressV2");
      import("@/components/MomentumFlame");
      import("@/components/AIChatDrawer");
      import("@/components/SmartRecallFeed");
      import("@/components/RecallBonusCard");
      import("@/components/EndOfDayMicroReview");
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
}

/** Inner shell that consumes logs from LogsProvider and sets up the world. */
function MomentumShell({ children }: { children: ReactNode }) {
  const { logs, loading } = useLogs();
  usePreloadComponents();

  return (
    <DebriefsProvider>
      <MomentumProvider logs={logs} loading={loading}>
        <WorldRenderer>
          <SmartRecallProvider>
            {children}
            <SoundManager />
            <CompletionCelebration />
            <WeeklyDebriefModal />
          </SmartRecallProvider>
        </WorldRenderer>
      </MomentumProvider>
    </DebriefsProvider>
  );
}

/** 
 * Shared client shell for all dashboard pages.
 * Mounts ONCE at the layout level — never re-mounts on tab switch.
 */
export default function DashboardClientShell({ children }: { children: ReactNode }) {
  return (
    <LogsProvider>
      <TabProvider>
        <MomentumShell>
          {children}
        </MomentumShell>
      </TabProvider>
    </LogsProvider>
  );
}
