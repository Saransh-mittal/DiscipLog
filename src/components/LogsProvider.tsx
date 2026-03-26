"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { DashboardLog, sortLogsByTimestamp } from "@/lib/logs";

interface LogsContextValue {
  logs: DashboardLog[];
  loading: boolean;
  refreshLogs: () => void;
}

const LogsContext = createContext<LogsContextValue>({
  logs: [],
  loading: true,
  refreshLogs: () => {},
});

export function useLogs() {
  return useContext(LogsContext);
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<DashboardLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLogs = useCallback(() => {
    fetch("/api/logs")
      .then((res) => res.json())
      .then((data) => {
        setLogs(sortLogsByTimestamp(data || []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Initial fetch + visibility-based refresh
  useEffect(() => {
    refreshLogs();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshLogs();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshLogs]);

  return (
    <LogsContext.Provider value={{ logs, loading, refreshLogs }}>
      {children}
    </LogsContext.Provider>
  );
}
