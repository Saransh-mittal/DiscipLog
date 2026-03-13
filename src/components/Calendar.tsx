"use client";

import { useEffect, useState } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";

export default function Calendar() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logs")
      .then(res => res.json())
      .then(data => {
        setLogs(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Compute daily totals
  const dailyTotals = logs.reduce((acc: any, log: any) => {
    acc[log.date] = (acc[log.date] || 0) + log.hours;
    return acc;
  }, {});

  const today = new Date();
  const past30Days = eachDayOfInterval({
    start: subDays(today, 34), // show 35 blocks (5 weeks)
    end: today
  });

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative h-full flex flex-col">
      <h3 className="text-2xl font-bold text-white mb-8 tracking-tight">Discipline History</h3>
      
      {loading ? (
        <div className="flex-1 flex px-4 items-center justify-center opacity-50">Loading metrics...</div>
      ) : (
        <div className="grid grid-cols-7 gap-3 xl:gap-4 mb-4">
          {past30Days.map((date: Date, i: number) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const hours = dailyTotals[dateStr] || 0;
            
            let colorClass = "bg-zinc-950/50 border-white/5 text-zinc-600"; // Empty
            if (hours > 0 && hours < 4) colorClass = "bg-rose-500/10 border-rose-500/20 text-rose-300"; // Light work
            if (hours >= 4 && hours < 8) colorClass = "bg-amber-500/20 border-amber-500/30 text-amber-300"; // Under 8h
            if (hours >= 8) colorClass = "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] font-bold"; // Goal hit!

            return (
              <div 
                key={dateStr} 
                className={`relative group aspect-square rounded-xl border flex flex-col items-center justify-center transition-all hover:scale-110 cursor-default ${colorClass}`}
              >
                <span className="text-sm opacity-90">{format(date, "d")}</span>
                {hours > 0 && <span className="text-[0.65rem] absolute bottom-1.5 opacity-80">{hours}h</span>}
                
                {/* Tooltip */}
                <div className="absolute inset-x-0 -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-xs text-center p-2 rounded pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                  {format(date, "MMM d")}: {hours} hours
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div className="mt-auto flex items-center justify-between text-xs font-semibold text-zinc-500 px-2 pt-6 border-t border-white/5">
        <div className="flex gap-3 items-center">
          <div className="w-4 h-4 rounded shadow-inner bg-zinc-950/50 border border-white/5"></div> 0h
        </div>
        <div className="flex gap-3 items-center">
          <div className="w-4 h-4 rounded shadow-inner bg-amber-500/20 border border-amber-500/30"></div> 4h+
        </div>
        <div className="flex gap-3 items-center text-emerald-400">
          <div className="w-4 h-4 rounded shadow-[0_0_10px_rgba(16,185,129,0.5)] bg-emerald-500 border border-emerald-400"></div> ≥8h Goal
        </div>
      </div>
    </div>
  );
}
