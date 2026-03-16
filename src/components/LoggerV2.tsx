"use client";

import { useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Save, Plus, Minus, CheckCircle2 } from "lucide-react";
import { DashboardLog, LOG_CATEGORIES, type LogCategory } from "@/lib/logs";

interface LoggerV2Props {
  onLogSaved?: () => void;
}

export default function LoggerV2({ onLogSaved }: LoggerV2Props) {
  const {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    supported,
    resetTranscript,
  } = useSpeechRecognition();

  const [category, setCategory] = useState<LogCategory>("Building");
  const [hours, setHours] = useState(2);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [savedLog, setSavedLog] = useState<DashboardLog | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    if (!transcript.trim()) return;
    setIsSummarizing(true);
    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const loggedAt = new Date().toISOString();

      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        body: JSON.stringify({ text: transcript, category }),
        headers: { "Content-Type": "application/json" },
      });
      if (!sumRes.ok) {
        throw new Error(await sumRes.text());
      }
      const sumData = await sumRes.json();

      const res = await fetch("/api/logs", {
        method: "POST",
        body: JSON.stringify({
          source: "manual",
          hours,
          category,
          rawTranscript: transcript,
          summary: sumData.summary,
          loggedAt,
          timezone,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const logData = await res.json();
        setSavedLog(logData);
        resetTranscript();
        setShowSuccess(true);
        onLogSaved?.();
        // Auto-hide success after 6 seconds
        setTimeout(() => setShowSuccess(false), 6000);
      } else {
        throw new Error(await res.text());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  const incrementHours = () => setHours((h) => Math.min(h + 0.5, 24));
  const decrementHours = () => setHours((h) => Math.max(h - 0.5, 0.5));

  return (
    <Card
      className="relative overflow-hidden p-0 border"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      {/* Top gradient accent */}
      <div
        className="h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--v2-amber-500), var(--v2-amber-300), var(--v2-amber-500))",
        }}
      />

      <div className="p-6 md:p-8">
        {/* Section label */}
        <h3
          className="text-lg font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          New Entry
        </h3>

        {/* Category tabs */}
        <div className="mb-6">
          <label
            className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 block"
            style={{
              color: "var(--v2-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Category
          </label>
          <Tabs
            value={category}
            onValueChange={(value) => setCategory(value as LogCategory)}
          >
            <TabsList
              className="w-full flex flex-wrap gap-2 h-auto p-1 rounded-xl"
              style={{
                background: "var(--v2-surface-raised)",
              }}
            >
              {LOG_CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="flex-1 min-w-[80px] text-xs font-semibold py-2 px-3 rounded-lg transition-all duration-200 data-[state=active]:shadow-md"
                  style={{
                    fontFamily: "var(--font-body)",
                    color:
                      category === cat
                        ? "var(--v2-obsidian-900)"
                        : "var(--v2-text-muted)",
                    background:
                      category === cat
                        ? "var(--v2-amber-400)"
                        : "transparent",
                  }}
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Hours stepper */}
        <div className="mb-6">
          <label
            className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 block"
            style={{
              color: "var(--v2-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Hours Logged
          </label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={decrementHours}
              className="h-10 w-10 rounded-xl border transition-all"
              style={{
                borderColor: "var(--v2-border-strong)",
                background: "var(--v2-surface-raised)",
                color: "var(--v2-text-secondary)",
              }}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <div
              className="text-3xl font-bold tracking-tight min-w-[80px] text-center"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--v2-amber-300)",
              }}
            >
              {hours}
              <span
                className="text-sm font-semibold ml-1"
                style={{ color: "var(--v2-text-muted)" }}
              >
                hrs
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={incrementHours}
              className="h-10 w-10 rounded-xl border transition-all"
              style={{
                borderColor: "var(--v2-border-strong)",
                background: "var(--v2-surface-raised)",
                color: "var(--v2-text-secondary)",
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Transcript textarea */}
        <div className="relative mb-6">
          <label
            className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 block"
            style={{
              color: "var(--v2-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Log Entry
          </label>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              supported
                ? "Type your log here, or tap the mic to dictate..."
                : "Type your log manually (Speech-to-Text unavailable)..."
            }
            className="min-h-[180px] resize-none rounded-xl border text-sm leading-relaxed transition-all duration-300"
            style={{
              background: "var(--v2-surface-raised)",
              borderColor: isListening
                ? "var(--v2-amber-400)"
                : "var(--v2-border)",
              color: "var(--v2-text-primary)",
              fontFamily: "var(--font-body)",
              boxShadow: isListening
                ? "0 0 30px oklch(0.65 0.19 60 / 10%)"
                : "none",
            }}
          />

          {/* Recording indicator */}
          {isListening && (
            <div className="absolute bottom-4 left-4 flex items-center gap-3">
              <div className="v2-waveform">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="v2-waveform-bar" />
                ))}
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{
                  color: "var(--v2-amber-400)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Recording
              </span>
            </div>
          )}

          {/* Character count */}
          <span
            className="absolute bottom-4 right-4 text-[10px] font-medium"
            style={{ color: "var(--v2-obsidian-400)" }}
          >
            {transcript.length} chars
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-col sm:flex-row">
          {supported && (
            <Button
              onClick={isListening ? stopListening : startListening}
              variant="outline"
              className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 transition-all duration-200 border"
              style={{
                borderColor: isListening
                  ? "var(--v2-amber-400)"
                  : "var(--v2-border-strong)",
                background: isListening
                  ? "oklch(0.65 0.19 60 / 8%)"
                  : "var(--v2-obsidian-700)",
                color: isListening
                  ? "var(--v2-amber-300)"
                  : "var(--v2-text-secondary)",
                fontFamily: "var(--font-body)",
              }}
            >
              {isListening ? (
                <>
                  <Square className="w-4 h-4 fill-current" /> Stop
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" /> Record
                </>
              )}
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={!transcript.trim() || isSummarizing}
            className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 transition-all duration-200 disabled:opacity-40 v2-glow-btn"
            style={{
              background:
                "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
              color: "var(--v2-obsidian-900)",
              fontFamily: "var(--font-body)",
              border: "none",
            }}
          >
            {isSummarizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSummarizing ? "Summarizing..." : "Save Log"}
          </Button>
        </div>
      </div>

      {/* Success toast */}
      {showSuccess && savedLog && (
        <div
          className="border-t px-6 md:px-8 py-5 transition-all duration-500"
          style={{
            borderColor: "oklch(0.62 0.14 155 / 20%)",
            background: "oklch(0.62 0.14 155 / 4%)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2
              className="w-4 h-4"
              style={{ color: "var(--v2-sage-400)" }}
            />
            <span
              className="text-sm font-bold tracking-tight"
              style={{
                color: "var(--v2-sage-400)",
                fontFamily: "var(--font-display)",
              }}
            >
              Logged & Summarized
            </span>
          </div>
          <ul
            className="text-sm space-y-1.5 list-disc list-inside"
            style={{
              color: "var(--v2-text-secondary)",
              fontFamily: "var(--font-body)",
            }}
          >
            {savedLog.aiSummary
              ?.split("\n")
              .filter((l: string) => l.trim().length > 0)
              .map((bullet: string, i: number) => (
                <li key={i} className="leading-relaxed pl-1">
                  {bullet.replace(/^[-•*]\s*/, "").trim()}
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
