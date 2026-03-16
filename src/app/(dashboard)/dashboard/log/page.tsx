"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DashboardLog, sortLogsByTimestamp } from "@/lib/logs";

const LoggerV2 = dynamic(() => import("@/components/LoggerV2"), { ssr: false });
const SprintTimerCard = dynamic(() => import("@/components/SprintTimerCard"), { ssr: false });
const AIAssistantV2 = dynamic(() => import("@/components/AIAssistantV2"), { ssr: false });

export default function LogPage() {
  const [logs, setLogs] = useState<DashboardLog[]>([]);

  const refreshLogs = () => {
    fetch("/api/logs")
      .then((res) => res.json())
      .then((data) => setLogs(sortLogsByTimestamp(data || [])))
      .catch(() => {});
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
          Log your <span style={{ color: "var(--v2-amber-400)" }}>discipline</span>
        </h1>
        <p
          className="max-w-xl text-base leading-relaxed"
          style={{ color: "var(--v2-text-secondary)" }}
        >
          Record your blocks naturally. AI categorizes your time and calculates performance automatically.
        </p>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="v2-stagger-in v2-stagger-2">
          <LoggerV2 onLogSaved={refreshLogs} />
        </div>
        <div className="v2-stagger-in v2-stagger-3">
          <SprintTimerCard onLogSaved={refreshLogs} />
        </div>
      </div>

      <AIAssistantV2 logs={logs} />
    </div>
  );
}
