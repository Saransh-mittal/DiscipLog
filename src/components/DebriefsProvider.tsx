"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface DebriefCategoryBreakdown {
  name: string;
  hours: number;
  logCount: number;
  targetHit: boolean;
  prevWeekHours: number | null;
}

export interface DebriefCommitment {
  _id: string;
  text: string;
  status: string;
  weekStart?: string;
}

export interface DebriefData {
  _id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  totalLogs: number;
  bestDay: { date: string; hours: number };
  consistencyPercent: number;
  categoryBreakdown: DebriefCategoryBreakdown[];
  weekTitle: string;
  coachNote: string;
  mvpCategory: string;
  hardestDay: string;
  challengeForNextWeek: string;
  commitments?: DebriefCommitment[];
}

interface DebriefsContextValue {
  latestDebrief: DebriefData | null;
  historyDebriefs: DebriefData[];
  hasArchives: boolean;
  latestLoading: boolean;
  historyLoading: boolean;
  refreshLatest: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  acknowledgeDebrief: (id: string) => Promise<void>;
}

const DebriefsContext = createContext<DebriefsContextValue>({
  latestDebrief: null,
  historyDebriefs: [],
  hasArchives: false,
  latestLoading: true,
  historyLoading: true,
  refreshLatest: async () => {},
  refreshHistory: async () => {},
  acknowledgeDebrief: async () => {},
});

function sortDebriefs(debriefs: DebriefData[]): DebriefData[] {
  return [...debriefs].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
}

export function useDebriefs() {
  return useContext(DebriefsContext);
}

export function DebriefsProvider({ children }: { children: ReactNode }) {
  const [latestDebrief, setLatestDebrief] = useState<DebriefData | null>(null);
  const [historyDebriefs, setHistoryDebriefs] = useState<DebriefData[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  const refreshLatest = useCallback(async () => {
    setLatestLoading(true);
    try {
      const res = await fetch("/api/debriefs/latest");
      if (!res.ok) {
        throw new Error(`Failed to fetch latest debrief: ${res.status}`);
      }

      const data = await res.json();
      setLatestDebrief(data && data._id ? data : null);
    } catch (error) {
      console.error("Failed to fetch latest debrief:", error);
    } finally {
      setLatestLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/debriefs/history");
      if (!res.ok) {
        throw new Error(`Failed to fetch debrief history: ${res.status}`);
      }

      const data = await res.json();
      setHistoryDebriefs(Array.isArray(data) ? sortDebriefs(data) : []);
    } catch (error) {
      console.error("Failed to fetch debrief history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLatest();
    void refreshHistory();
  }, [refreshHistory, refreshLatest]);

  const acknowledgeDebrief = useCallback(async (id: string) => {
    const acknowledgedDebrief = latestDebrief && latestDebrief._id === id ? latestDebrief : null;

    const res = await fetch(`/api/debriefs/${id}/acknowledge`, { method: "PATCH" });
    if (!res.ok) {
      throw new Error(`Failed to acknowledge debrief: ${res.status}`);
    }

    setLatestDebrief((current) => (current?._id === id ? null : current));

    if (acknowledgedDebrief) {
      setHistoryDebriefs((current) => {
        const withoutDuplicate = current.filter((debrief) => debrief._id !== acknowledgedDebrief._id);
        return sortDebriefs([acknowledgedDebrief, ...withoutDuplicate]);
      });
    }
  }, [latestDebrief]);

  return (
    <DebriefsContext.Provider
      value={{
        latestDebrief,
        historyDebriefs,
        hasArchives: historyDebriefs.length > 0,
        latestLoading,
        historyLoading,
        refreshLatest,
        refreshHistory,
        acknowledgeDebrief,
      }}
    >
      {children}
    </DebriefsContext.Provider>
  );
}
