"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DashboardLog, sortLogsByTimestamp } from "@/lib/logs";

const LogHistoryV2 = dynamic(() => import("@/components/LogHistoryV2"), { ssr: false });
const AIAssistantV2 = dynamic(() => import("@/components/AIAssistantV2"), { ssr: false });

export default function HistoryPage() {
  const [logs, setLogs] = useState<DashboardLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLogs = () => {
    fetch("/api/logs")
      .then((res) => res.json())
      .then((data) => {
        setLogs(sortLogsByTimestamp(data || []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  return (
    <div className="space-y-8">
      <section className="v2-stagger-in v2-stagger-1">
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

      <div className="v2-stagger-in v2-stagger-2">
        <LogHistoryV2 logs={logs} loading={loading} refreshLogs={refreshLogs} />
      </div>

      <AIAssistantV2 logs={logs} />
    </div>
  );
}
