"use client";

import { useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import { useMomentum } from "@/components/MomentumProvider";
import { triggerSound } from "@/components/SoundManager";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Save, CheckCircle2 } from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";
import type { DashboardLog } from "@/lib/logs";
import { SMART_RECALL_LOG_SAVED_EVENT } from "@/lib/smart-recall-types";

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
  const { microInteractions } = useMomentum();
  const [category, setCategory] = useState("");
  const [inputHours, setInputHours] = useState<number | "">(2);
  const [inputMinutes, setInputMinutes] = useState<number | "">(0);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [savedLog, setSavedLog] = useState<DashboardLog | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

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
        triggerSound(microInteractions.completionSound);
        onLogSaved?.();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(SMART_RECALL_LOG_SAVED_EVENT));
        }
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
    <div className="quicklog-card">
      {/* Textarea — the hero */}
      <div className="quicklog-textarea-wrap">
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={
            supported
              ? "What did you work on? Type or tap mic to dictate…"
              : "What did you work on?"
          }
          className="quicklog-textarea"
          style={{
            borderColor: isListening
              ? "var(--world-accent, var(--v2-amber-400))"
              : "var(--v2-border)",
            boxShadow: isListening
              ? "0 0 20px color-mix(in oklch, var(--world-accent, var(--v2-amber-500)) 15%, transparent)"
              : "none",
          }}
        />

        {/* Recording indicator */}
        {isListening && (
          <div className="quicklog-recording">
            <div className="v2-waveform" style={{ height: 20 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="v2-waveform-bar" />
              ))}
            </div>
            <span>Recording</span>
          </div>
        )}

        {/* Char count */}
        <span className="quicklog-charcount">
          {transcript.length}
        </span>
      </div>

      {/* Inline controls row */}
      <div className="quicklog-controls">
        {/* Category pills */}
        <div className="quicklog-categories">
          {categories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setCategory(cat.name)}
              className={`quicklog-cat-pill ${activeCategory === cat.name ? "active" : ""}`}
            >
              <DynamicIcon name={cat.icon} className="w-3 h-3" />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Time + Actions */}
        <div className="quicklog-actions-row">
          <div className="quicklog-time-group">
            <input
              type="number"
              value={inputHours}
              onChange={(e) =>
                setInputHours(
                  e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : ""
                )
              }
              className="quicklog-time-input"
              min={0}
              aria-label="Hours"
            />
            <span className="quicklog-time-label">h</span>
            <input
              type="number"
              value={inputMinutes}
              onChange={(e) =>
                setInputMinutes(
                  e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : ""
                )
              }
              className="quicklog-time-input"
              min={0}
              max={59}
              aria-label="Minutes"
            />
            <span className="quicklog-time-label">m</span>
          </div>

          <div className="quicklog-buttons">
            {supported && (
              <Button
                onClick={isListening ? stopListening : startListening}
                variant="outline"
                className="quicklog-mic-btn"
                style={{
                  borderColor: isListening
                    ? "var(--world-accent, var(--v2-amber-400))"
                    : "var(--v2-border-strong)",
                  background: isListening
                    ? "color-mix(in oklch, var(--world-accent, var(--v2-amber-500)) 12%, transparent)"
                    : "var(--v2-obsidian-700)",
                  color: isListening
                    ? "var(--world-accent, var(--v2-amber-300))"
                    : "var(--v2-text-secondary)",
                }}
              >
                {isListening ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </Button>
            )}

            <Button
              onClick={handleSave}
              disabled={!transcript.trim() || isSummarizing}
              className="quicklog-save-btn v2-glow-btn"
            >
              {isSummarizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isSummarizing ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Success feedback */}
      {showSuccess && savedLog && (
        <div className="quicklog-success">
          <div className="quicklog-success-header">
            <CheckCircle2
              className="w-3.5 h-3.5"
              style={{ color: "var(--v2-sage-400)" }}
            />
            <span>Logged</span>
          </div>
          <ul className="quicklog-success-list">
            {savedLog.aiSummary
              ?.split("\n")
              .filter((l: string) => l.trim().length > 0)
              .map((bullet: string, i: number) => (
                <li key={i}>
                  {bullet.replace(/^[-•*]\s*/, "").trim()}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
