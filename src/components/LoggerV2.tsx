"use client";

import { useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Save, CheckCircle2 } from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";
import type { DashboardLog } from "@/lib/logs";

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

  const { categories } = useCategoriesContext();
  const [category, setCategory] = useState("");
  const [inputHours, setInputHours] = useState<number | "">(2);
  const [inputMinutes, setInputMinutes] = useState<number | "">(0);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [savedLog, setSavedLog] = useState<DashboardLog | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Default to first category if not set
  const activeCategory = category || categories[0]?.name || "";

  const handleSave = async () => {
    if (!transcript.trim()) return;
    setIsSummarizing(true);
    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const loggedAt = new Date().toISOString();

      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        body: JSON.stringify({ text: transcript, category: activeCategory }),
        headers: { "Content-Type": "application/json" },
      });
      if (!sumRes.ok) {
        throw new Error(await sumRes.text());
      }
      const sumData = await sumRes.json();
      const totalHours = (Number(inputHours) || 0) + (Number(inputMinutes) || 0) / 60;

      const res = await fetch("/api/logs", {
        method: "POST",
        body: JSON.stringify({
          source: "manual",
          hours: totalHours,
          category: activeCategory,
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
            value={activeCategory}
            onValueChange={(value) => setCategory(value)}
          >
            <TabsList
              className="w-full flex flex-wrap gap-2 h-auto p-1 rounded-xl"
              style={{
                background: "var(--v2-surface-raised)",
              }}
            >
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.name}
                  value={cat.name}
                  className="flex-1 min-w-[80px] text-xs font-semibold py-2 px-3 rounded-lg transition-all duration-200 data-[state=active]:shadow-md flex items-center gap-1.5"
                  style={{
                    fontFamily: "var(--font-body)",
                    color:
                      activeCategory === cat.name
                        ? "var(--v2-obsidian-900)"
                        : "var(--v2-text-muted)",
                    background:
                      activeCategory === cat.name
                        ? "var(--v2-amber-400)"
                        : "transparent",
                  }}
                >
                  <DynamicIcon name={cat.icon} className="w-3.5 h-3.5" />
                  {cat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Time Inputs */}
        <div className="mb-6">
          <label
            className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 block"
            style={{
              color: "var(--v2-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Time Logged
          </label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inputHours}
                onChange={(e) =>
                  setInputHours(
                    e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : ""
                  )
                }
                className="h-12 w-20 rounded-xl border text-center text-2xl font-bold shadow-none transition-all duration-200 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] focus:outline-none focus:ring-2 flex-shrink-0"
                style={{
                  background: "var(--v2-surface-overlay)",
                  borderColor: "var(--v2-border-strong)",
                  color: "var(--v2-amber-300)",
                  fontFamily: "var(--font-display)",
                }}
                min={0}
              />
              <span
                className="text-sm font-semibold whitespace-nowrap"
                style={{ color: "var(--v2-text-muted)", fontFamily: "var(--font-body)" }}
              >
                hrs
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                value={inputMinutes}
                onChange={(e) =>
                  setInputMinutes(
                    e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : ""
                  )
                }
                className="h-12 w-20 rounded-xl border text-center text-2xl font-bold shadow-none transition-all duration-200 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] focus:outline-none focus:ring-2 flex-shrink-0"
                style={{
                  background: "var(--v2-surface-overlay)",
                  borderColor: "var(--v2-border-strong)",
                  color: "var(--v2-amber-300)",
                  fontFamily: "var(--font-display)",
                }}
                min={0}
                max={59}
              />
              <span
                className="text-sm font-semibold whitespace-nowrap"
                style={{ color: "var(--v2-text-muted)", fontFamily: "var(--font-body)" }}
              >
                mins
              </span>
            </div>
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
