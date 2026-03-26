"use client";

import { useState, useEffect } from "react";
import { Loader2, Trophy, Target, Sparkles, Filter, ChevronLeft, Calendar, Minus, TrendingUp, TrendingDown, CheckCircle2, Circle, XCircle } from "lucide-react";
import WorldCard from "@/components/WorldCard";

interface DebriefData {
  _id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  totalLogs: number;
  bestDay: { date: string; hours: number };
  consistencyPercent: number;
  categoryBreakdown: any[];
  weekTitle: string;
  coachNote: string;
  mvpCategory: string;
  hardestDay: string;
  challengeForNextWeek: string;
  commitments?: any[];
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} \u2013 ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function TrendArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.25) {
    return <Minus style={{ width: "0.75rem", height: "0.75rem", color: "var(--world-text-muted, var(--v2-text-muted))" }} />;
  }
  if (diff > 0) {
    return <TrendingUp style={{ width: "0.75rem", height: "0.75rem", color: "var(--v2-sage-400)" }} />;
  }
  return <TrendingDown style={{ width: "0.75rem", height: "0.75rem", color: "var(--v2-rose-400)" }} />;
}

export default function DebriefArchive() {
  const [debriefs, setDebriefs] = useState<DebriefData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebrief, setSelectedDebrief] = useState<DebriefData | null>(null);

  useEffect(() => {
    fetch("/api/debriefs/history")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDebriefs(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch debriefs:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }} />
      </div>
    );
  }

  if (debriefs.length === 0) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center text-center">
        <Sparkles className="h-10 w-10 mb-4" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }} />
        <p style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>No weekly debriefs available yet.</p>
        <p className="text-sm mt-2" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}>Complete a full week of logging to receive your first debrief!</p>
      </div>
    );
  }

  if (selectedDebrief) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedDebrief(null)}
          className="flex items-center gap-2 text-sm transition hover:opacity-80"
          style={{ fontFamily: "var(--font-display)", color: "var(--world-text-muted, var(--v2-text-muted))" }}
        >
          <ChevronLeft className="w-4 h-4" /> Back to Archive
        </button>
        <WorldCard>
          <div className="p-2 sm:p-4">
            <p className="text-xs font-[var(--font-body)] uppercase tracking-widest mb-3" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>
              {formatDateRange(selectedDebrief.weekStartDate, selectedDebrief.weekEndDate)}
            </p>
            <h1 className="text-3xl font-extrabold font-[var(--font-display)] mb-8" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>
              {selectedDebrief.weekTitle}
            </h1>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl border p-4 flex flex-col items-center justify-center text-center" style={{ background: "var(--world-surface-raised, var(--v2-surface-raised))", borderColor: "var(--world-border, var(--v2-border))" }}>
                <span className="text-[10px] uppercase font-[var(--font-display)] tracking-widest mb-1" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>Total Hours</span>
                <span className="text-2xl font-bold font-[var(--font-display)]" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>{selectedDebrief.totalHours}</span>
                <span className="text-[11px]" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}>{selectedDebrief.totalLogs} sessions</span>
              </div>
              <div className="rounded-xl border p-4 flex flex-col items-center justify-center text-center" style={{ background: "var(--world-surface-raised, var(--v2-surface-raised))", borderColor: "var(--world-border, var(--v2-border))" }}>
                <span className="text-[10px] uppercase font-[var(--font-display)] tracking-widest mb-1" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>Consistency</span>
                <span className="text-2xl font-bold font-[var(--font-display)]" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>{selectedDebrief.consistencyPercent}%</span>
                <span className="text-[11px]" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}>of 7 days</span>
              </div>
              <div className="rounded-xl border p-4 flex flex-col items-center justify-center text-center" style={{ background: "var(--world-surface-raised, var(--v2-surface-raised))", borderColor: "var(--world-border, var(--v2-border))" }}>
                <span className="text-[10px] uppercase font-[var(--font-display)] tracking-widest mb-1" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>Best Day</span>
                <span className="text-2xl font-bold font-[var(--font-display)]" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>{selectedDebrief.bestDay.hours}h</span>
                <span className="text-[11px]" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}>Focus output</span>
              </div>
            </div>

            {selectedDebrief.mvpCategory && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-[var(--font-display)]" style={{ borderColor: "color-mix(in oklch, var(--world-accent) 30%, transparent)", background: "color-mix(in oklch, var(--world-accent) 15%, transparent)", color: "var(--world-accent, var(--v2-amber-400))" }}>
                <Trophy className="w-4 h-4" /> MVP: {selectedDebrief.mvpCategory}
              </div>
            )}

            <div className="mb-6 border-l-4 p-5 rounded-r-xl" style={{ borderLeftColor: "var(--world-accent, var(--v2-amber-500))", background: "var(--world-surface-raised, var(--v2-surface-raised))" }}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>
                {selectedDebrief.coachNote}
              </p>
            </div>

            {selectedDebrief.hardestDay && (
              <p className="mb-6 text-[13px] italic leading-relaxed" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>
                {selectedDebrief.hardestDay}
              </p>
            )}

            {/* Category Breakdown */}
            {selectedDebrief.categoryBreakdown && selectedDebrief.categoryBreakdown.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[11px] font-[var(--font-display)] tracking-widest uppercase mb-4" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>
                  Category Breakdown
                </h3>
                <div className="flex flex-col gap-3">
                  {selectedDebrief.categoryBreakdown.map((cat: any) => {
                    const maxCatHours = Math.max(...selectedDebrief.categoryBreakdown.map((c: any) => c.hours), 1);
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="w-20 text-xs font-[var(--font-body)] truncate" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}>
                          {cat.name}
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--world-surface-raised, var(--v2-surface-raised))" }}>
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                              width: `${Math.min((cat.hours / maxCatHours) * 100, 100)}%`,
                              background: "linear-gradient(90deg, var(--world-accent, var(--v2-amber-500)), var(--world-accent, var(--v2-amber-500)))",
                              boxShadow: cat.targetHit ? "0 0 8px var(--world-accent-glow, oklch(0.65 0.19 60 / 30%))" : "none",
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold font-[var(--font-display)] w-10 text-right" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>
                          {cat.hours}h
                        </span>
                        <TrendArrow current={cat.hours} previous={cat.prevWeekHours} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Commitments */}
            {selectedDebrief.commitments && selectedDebrief.commitments.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[11px] font-[var(--font-display)] tracking-widest uppercase mb-4" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>
                  Weekly Commitments
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedDebrief.commitments.map((c: any) => (
                    <div key={c._id} className="flex items-center gap-3 p-3 rounded-lg border transition-colors" style={{ background: "var(--world-surface-raised, var(--v2-surface-raised))", borderColor: "var(--world-border, var(--v2-border))" }}>
                      {c.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4" style={{ color: "var(--v2-sage-400)" }} />
                      ) : c.status === "missed" ? (
                        <XCircle className="w-4 h-4" style={{ color: "var(--v2-rose-400)" }} />
                      ) : (
                        <Circle className="w-4 h-4" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }} />
                      )}
                      <span className="text-sm font-[var(--font-body)]" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}>
                        {c.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedDebrief.challengeForNextWeek && (
              <div className="flex items-start gap-4 rounded-xl border p-5" style={{ borderColor: "color-mix(in oklch, var(--world-accent) 30%, transparent)", background: "linear-gradient(135deg, color-mix(in oklch, var(--world-accent) 25%, transparent), color-mix(in oklch, var(--world-accent) 10%, transparent))" }}>
                <Target className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--world-accent, var(--v2-amber-400))" }} />
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider font-[var(--font-display)]" style={{ color: "var(--world-accent, var(--v2-amber-400))" }}>Next Week's Challenge</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>{selectedDebrief.challengeForNextWeek}</p>
                </div>
              </div>
            )}
          </div>
        </WorldCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1
          className="mb-2 text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl"
          style={{ fontFamily: "var(--font-display)", color: "var(--world-text-primary, var(--v2-text-primary))" }}
        >
          Archive
        </h1>
        <p className="max-w-xl text-base leading-relaxed" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))" }}>
          Past weekly overviews and AI coach notes.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {debriefs.map((debrief) => (
          <WorldCard 
            key={debrief._id} 
            className="cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <div 
              onClick={() => setSelectedDebrief(debrief)}
              className="p-1"
            >
              <div className="mb-3 flex items-center justify-between text-xs tracking-wider uppercase font-[var(--font-display)]" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateRange(debrief.weekStartDate, debrief.weekEndDate)}
                </div>
              </div>
              <h3 className="mb-4 text-xl font-bold font-[var(--font-display)]" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>
                {debrief.weekTitle}
              </h3>
              <div className="flex items-center gap-6 text-sm border-t pt-4" style={{ color: "var(--world-text-secondary, var(--v2-text-secondary))", borderColor: "var(--world-border, var(--v2-border))" }}>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>Time</span>
                  <span className="font-semibold" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>{debrief.totalHours}h</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>Consistency</span>
                  <span className="font-semibold" style={{ color: "var(--world-text-primary, var(--v2-text-primary))" }}>{debrief.consistencyPercent}%</span>
                </div>
                {debrief.mvpCategory && (
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}>MVP</span>
                    <span className="font-semibold" style={{ color: "var(--world-accent, var(--v2-amber-400))" }}>{debrief.mvpCategory}</span>
                  </div>
                )}
              </div>
            </div>
          </WorldCard>
        ))}
      </div>
    </div>
  );
}
