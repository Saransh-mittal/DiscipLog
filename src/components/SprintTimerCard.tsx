"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon from "@/components/DynamicIcon";
import {
  type SprintCompletionStatus,
} from "@/lib/logs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle2,
  Flag,
  Loader2,
  Mic,
  Minus,
  Pause,
  Play,
  Plus,
  Sparkles,
  Square,
  TimerReset,
} from "lucide-react";
import { SMART_RECALL_LOG_SAVED_EVENT } from "@/lib/smart-recall-types";

const SPRINT_STORAGE_KEY = "disciplog.active-sprint.v1";
const DURATION_PRESETS = [25, 50, 90] as const;
const MIN_CUSTOM_MINUTES = 1;
const MAX_CUSTOM_MINUTES = 240;

type SprintStatus = "idle" | "running" | "paused" | "awaiting_checkin";

interface SprintState {
  status: SprintStatus;
  category: string;
  plannedMinutes: number;
  accumulatedActiveMs: number;
  startedAt: string | null;
  lastResumedAt: string | null;
  completedAt: string | null;
  completionStatus: SprintCompletionStatus | null;
  checkInText: string;
}

interface SprintTimerCardProps {
  onLogSaved?: () => void;
}

function createIdleSprint(
  overrides: Partial<Pick<SprintState, "category" | "plannedMinutes">> = {}
): SprintState {
  return {
    status: "idle",
    category: overrides.category ?? "Building",
    plannedMinutes: overrides.plannedMinutes ?? 50,
    accumulatedActiveMs: 0,
    startedAt: null,
    lastResumedAt: null,
    completedAt: null,
    completionStatus: null,
    checkInText: "",
  };
}

function getPlannedMs(state: SprintState): number {
  return state.plannedMinutes * 60_000;
}

function getElapsedMs(state: SprintState, nowMs = Date.now()): number {
  const runningDelta =
    state.status === "running" && state.lastResumedAt
      ? Math.max(0, nowMs - new Date(state.lastResumedAt).getTime())
      : 0;

  return Math.min(getPlannedMs(state), state.accumulatedActiveMs + runningDelta);
}

function getRemainingMs(state: SprintState, nowMs = Date.now()): number {
  return Math.max(0, getPlannedMs(state) - getElapsedMs(state, nowMs));
}

function getCompletionTimestampMs(state: SprintState, fallbackMs = Date.now()): number {
  if (state.lastResumedAt) {
    return (
      new Date(state.lastResumedAt).getTime() +
      Math.max(0, getPlannedMs(state) - state.accumulatedActiveMs)
    );
  }
  return fallbackMs;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function formatMinutesLabel(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours}h ${remainder}m`;
  }

  return `${minutes}m`;
}

function roundElapsedMinutes(elapsedMs: number): number {
  return Math.max(1, Math.round(elapsedMs / 60_000));
}

function playCompletionTone() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    // @ts-expect-error webkit prefix is not included in lib dom types
    window.webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  try {
    const ctx = new AudioContextCtor();
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.22, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const beepSequence = [
      { start: 0, duration: 0.18, frequency: 880 },
      { start: 0.24, duration: 0.18, frequency: 1046 },
      { start: 0.48, duration: 0.28, frequency: 1318 },
    ];

    beepSequence.forEach(({ start, duration, frequency }) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.26, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + start + duration
      );

      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(ctx.currentTime + start);
      oscillator.stop(ctx.currentTime + start + duration);
    });

    const finalOscillator = ctx.createOscillator();
    finalOscillator.onended = () => {
      void ctx.close();
    };
    finalOscillator.connect(ctx.createGain());
    finalOscillator.start(ctx.currentTime + 0.75);
    finalOscillator.stop(ctx.currentTime + 0.76);
  } catch {
    // Audio feedback is best-effort only.
  }
}

function restoreSprintState(rawValue: string): SprintState | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<SprintState>;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.status !== "string" ||
      !["running", "paused", "awaiting_checkin"].includes(parsed.status) ||
      typeof parsed.category !== "string" ||
      !parsed.category.trim() ||
      !Number.isFinite(parsed.plannedMinutes) ||
      parsed.plannedMinutes! <= 0 ||
      !Number.isFinite(parsed.accumulatedActiveMs) ||
      typeof parsed.checkInText !== "string"
    ) {
      return null;
    }

    const state: SprintState = {
      status: parsed.status,
      category: parsed.category,
      plannedMinutes: Math.round(parsed.plannedMinutes!),
      accumulatedActiveMs: Math.max(0, Number(parsed.accumulatedActiveMs!)),
      startedAt:
        typeof parsed.startedAt === "string" && parsed.startedAt
          ? parsed.startedAt
          : null,
      lastResumedAt:
        typeof parsed.lastResumedAt === "string" && parsed.lastResumedAt
          ? parsed.lastResumedAt
          : null,
      completedAt:
        typeof parsed.completedAt === "string" && parsed.completedAt
          ? parsed.completedAt
          : null,
      completionStatus:
        parsed.completionStatus === "completed" ||
        parsed.completionStatus === "finished_early"
          ? parsed.completionStatus
          : null,
      checkInText: parsed.checkInText,
    };

    if (!state.startedAt) {
      return null;
    }

    if (state.status === "running") {
      if (!state.lastResumedAt) {
        return null;
      }

      const nowMs = Date.now();
      if (getRemainingMs(state, nowMs) <= 0) {
        return {
          ...state,
          status: "awaiting_checkin",
          accumulatedActiveMs: getPlannedMs(state),
          lastResumedAt: null,
          completedAt: new Date(getCompletionTimestampMs(state, nowMs)).toISOString(),
          completionStatus: "completed",
        };
      }
    }

    return state;
  } catch {
    return null;
  }
}

function splitSummaryBullets(summary: string | null) {
  if (!summary) {
    return [];
  }

  return summary
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export default function SprintTimerCard({ onLogSaved }: SprintTimerCardProps) {
  const { categories } = useCategoriesContext();
  const [sprint, setSprint] = useState<SprintState>(() => createIdleSprint());
  const [customMinutesInput, setCustomMinutesInput] = useState("50");
  const [incrementMinutesInput, setIncrementMinutesInput] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [alertError, setAlertError] = useState<string | null>(null);
  const [savedMeta, setSavedMeta] = useState<{
    actualMinutes: number;
    plannedMinutes: number;
  } | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const sprintRef = useRef(sprint);
  const dictationSeedRef = useRef("");
  const completionHandledRef = useRef(false);

  const {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    supported,
    resetTranscript,
  } = useSpeechRecognition();

  useEffect(() => {
    sprintRef.current = sprint;
  }, [sprint]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("Notification" in window) {
      setNotificationPermission(window.Notification.permission);
    }

    const rawValue = window.localStorage.getItem(SPRINT_STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    const restored = restoreSprintState(rawValue);
    if (!restored) {
      window.localStorage.removeItem(SPRINT_STORAGE_KEY);
      return;
    }

    setSprint(restored);
    setNowMs(Date.now());
    setCustomMinutesInput(String(restored.plannedMinutes));
    if (restored.status === "awaiting_checkin") {
      setIsDialogOpen(true);
      setJustCompleted(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sprint.status === "idle") {
      window.localStorage.removeItem(SPRINT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SPRINT_STORAGE_KEY, JSON.stringify(sprint));
  }, [sprint]);

  useEffect(() => {
    if (sprint.status !== "running") {
      completionHandledRef.current = false;
      return;
    }

    const interval = window.setInterval(() => {
      const nextNow = Date.now();
      setNowMs(nextNow);

      if (
        !completionHandledRef.current &&
        getRemainingMs(sprintRef.current, nextNow) <= 0
      ) {
        completionHandledRef.current = true;
        playCompletionTone();
        setJustCompleted(true);
        setSaveError(null);
        resetTranscript();
        setSprint((prev) => ({
          ...prev,
          status: "awaiting_checkin",
          accumulatedActiveMs: getPlannedMs(prev),
          lastResumedAt: null,
          completedAt: new Date(
            getCompletionTimestampMs(prev, nextNow)
          ).toISOString(),
          completionStatus: "completed",
        }));
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          document.visibilityState !== "visible" &&
          window.Notification.permission === "granted"
        ) {
          new window.Notification("Sprint complete", {
            body: `Your ${sprintRef.current.plannedMinutes} minute ${sprintRef.current.category} sprint is ready for check-in.`,
          });
        }
        setIsDialogOpen(true);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [resetTranscript, sprint.status]);

  useEffect(() => {
    if (!isListening || sprint.status !== "awaiting_checkin") {
      return;
    }

    const baseText = dictationSeedRef.current;
    const glue =
      baseText && transcript && !baseText.endsWith(" ") && !baseText.endsWith("\n")
        ? " "
        : "";

    setSprint((prev) =>
      prev.status === "awaiting_checkin"
        ? { ...prev, checkInText: `${baseText}${glue}${transcript}` }
        : prev
    );
  }, [isListening, sprint.status, transcript]);

  const remainingMs = useMemo(() => {
    if (sprint.status === "running") {
      return getRemainingMs(sprint, nowMs);
    }

    if (sprint.status === "idle") {
      return getPlannedMs(sprint);
    }

    return Math.max(0, getPlannedMs(sprint) - sprint.accumulatedActiveMs);
  }, [nowMs, sprint]);

  const elapsedMs = useMemo(() => getElapsedMs(sprint, nowMs), [nowMs, sprint]);
  const progress = useMemo(() => {
    const ratio = getPlannedMs(sprint) === 0 ? 0 : elapsedMs / getPlannedMs(sprint);
    return Math.min(100, Math.max(0, ratio * 100));
  }, [elapsedMs, sprint]);
  const activeMinutes = useMemo(() => roundElapsedMinutes(elapsedMs), [elapsedMs]);
  const selectedPreset = DURATION_PRESETS.includes(
    sprint.plannedMinutes as (typeof DURATION_PRESETS)[number]
  )
    ? sprint.plannedMinutes
    : null;
  const isSprintLive = sprint.status === "running" || sprint.status === "paused";
  const completionReady = sprint.status === "awaiting_checkin";
  const completionBullets = splitSummaryBullets(savedSummary);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sprint.status === "running" || sprint.status === "paused") {
      const formattedTime = formatCountdown(remainingMs);
      document.title = `${formattedTime} - Sprint`;
    } else {
      document.title = "DiscipLog";
    }

    return () => {
      document.title = "DiscipLog";
    };
  }, [sprint.status, remainingMs]);

  const updateSprintConfig = (category: string) => {
    setSprint((prev) =>
      prev.status === "idle" || prev.status === "awaiting_checkin"
        ? { ...prev, category }
        : prev
    );
  };

  const applyDuration = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    setSprint((prev) =>
      prev.status === "idle"
        ? { ...prev, plannedMinutes: Math.round(minutes) }
        : prev
    );
  };

  const handleCustomMinutesChange = (value: string) => {
    const sanitized = value.replace(/[^\d]/g, "");
    setCustomMinutesInput(sanitized);

    const numeric = Number(sanitized);
    if (sanitized && Number.isFinite(numeric) && numeric >= MIN_CUSTOM_MINUTES) {
      applyDuration(Math.min(MAX_CUSTOM_MINUTES, Math.round(numeric)));
    }
  };

  const adjustCustomMinutes = (delta: number) => {
    const currentBase =
      Number(customMinutesInput) || sprint.plannedMinutes;
    const nextValue = Math.min(
      MAX_CUSTOM_MINUTES,
      Math.max(MIN_CUSTOM_MINUTES, currentBase + delta)
    );

    setCustomMinutesInput(String(nextValue));
    applyDuration(nextValue);
  };

  const requestAlertPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setAlertError("Browser alerts are not supported here.");
      return;
    }

    setAlertError(null);

    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        playCompletionTone();
        return;
      }
    } catch {
      setAlertError("Could not request browser alert permission.");
    }
  };

  const resetToIdle = () => {
    stopListening();
    resetTranscript();
    setTranscript("");
    setSaveError(null);
    setIsSaving(false);
    setIsDialogOpen(false);
    setJustCompleted(false);
    completionHandledRef.current = false;
    setSprint((prev) =>
      createIdleSprint({
        category: prev.category,
        plannedMinutes: prev.plannedMinutes,
      })
    );
    setCustomMinutesInput(String(sprintRef.current.plannedMinutes));
  };

  const handleStart = () => {
    const nowIso = new Date().toISOString();
    setSavedSummary(null);
    setSavedMeta(null);
    setSaveError(null);
    setJustCompleted(false);
    completionHandledRef.current = false;
    resetTranscript();
    setSprint((prev) => ({
      ...prev,
      status: "running",
      accumulatedActiveMs: 0,
      startedAt: nowIso,
      lastResumedAt: nowIso,
      completedAt: null,
      completionStatus: null,
      checkInText: "",
    }));
    setNowMs(Date.now());
  };

  const handlePause = () => {
    setSprint((prev) => {
      if (prev.status !== "running") {
        return prev;
      }

      return {
        ...prev,
        status: "paused",
        accumulatedActiveMs: getElapsedMs(prev, Date.now()),
        lastResumedAt: null,
      };
    });
  };

  const handleResume = () => {
    const nowIso = new Date().toISOString();
    completionHandledRef.current = false;
    setNowMs(Date.now());
    setSprint((prev) =>
      prev.status === "paused"
        ? { ...prev, status: "running", lastResumedAt: nowIso }
        : prev
    );
  };

  const handleFinishNow = () => {
    const current = sprintRef.current;
    if (current.status !== "running" && current.status !== "paused") {
      return;
    }

    const finishedAtMs = Date.now();
    const finalElapsedMs = getElapsedMs(current, finishedAtMs);
    const finalStatus: SprintCompletionStatus =
      finalElapsedMs >= getPlannedMs(current) ? "completed" : "finished_early";

    stopListening();
    resetTranscript();
    playCompletionTone();
    setSaveError(null);
    setJustCompleted(true);
    setSprint((prev) => ({
      ...prev,
      status: "awaiting_checkin",
      accumulatedActiveMs: finalElapsedMs,
      lastResumedAt: null,
      completedAt: new Date(finishedAtMs).toISOString(),
      completionStatus: finalStatus,
    }));
    setIsDialogOpen(true);
  };

  const handleAddMoreTime = (additionalMinutes: number) => {
    setIsDialogOpen(false);
    setJustCompleted(false);
    setSaveError(null);
    completionHandledRef.current = false;
    stopListening();
    setSprint((prev) => {
      const newPlanned = prev.plannedMinutes + additionalMinutes;
      setCustomMinutesInput(String(newPlanned));
      return {
        ...prev,
        status: "running",
        plannedMinutes: newPlanned,
        lastResumedAt: new Date().toISOString(),
        completedAt: null,
        completionStatus: null,
      };
    });
    setNowMs(Date.now());
  };

  const handleAddCustomTime = () => {
    const numeric = Number(incrementMinutesInput);
    if (!incrementMinutesInput || !Number.isFinite(numeric) || numeric <= 0) {
      return;
    }
    handleAddMoreTime(Math.round(numeric));
    setIncrementMinutesInput("");
  };

  const handleVoiceToggle = () => {
    if (!supported || sprint.status !== "awaiting_checkin") {
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    dictationSeedRef.current = sprint.checkInText.trimEnd();
    setTranscript("");
    startListening();
  };

  const handleSaveSprint = async () => {
    if (sprint.status !== "awaiting_checkin" || !sprint.checkInText.trim()) {
      return;
    }

    const actualMinutes = roundElapsedMinutes(sprint.accumulatedActiveMs);
    const completionStatus =
      sprint.completionStatus ??
      (actualMinutes >= sprint.plannedMinutes ? "completed" : "finished_early");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setIsSaving(true);
    setSaveError(null);

    try {
      const summarizeRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sprint.checkInText,
          category: sprint.category,
        }),
      });

      if (!summarizeRes.ok) {
        throw new Error((await summarizeRes.text()) || "Unable to summarize sprint.");
      }

      const summarizeData = await summarizeRes.json();

      const saveRes = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "sprint",
          category: sprint.category,
          rawTranscript: sprint.checkInText,
          summary: summarizeData.summary,
          plannedMinutes: sprint.plannedMinutes,
          actualMinutes,
          startedAt: sprint.startedAt,
          completedAt: sprint.completedAt ?? new Date().toISOString(),
          completionStatus,
          timezone,
        }),
      });

      if (!saveRes.ok) {
        throw new Error((await saveRes.text()) || "Unable to save sprint log.");
      }

      const savedLog = await saveRes.json();

      setSavedSummary(savedLog.aiSummary || summarizeData.summary || null);
      setSavedMeta({
        actualMinutes,
        plannedMinutes: sprint.plannedMinutes,
      });
      setIsDialogOpen(false);
      resetToIdle();
      onLogSaved?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(SMART_RECALL_LOG_SAVED_EVENT));
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The sprint note is still here. Please retry or discard it."
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ─── Alert toggle helper ─── */
  const alertsGranted = notificationPermission === "granted";
  const alertsBlocked = notificationPermission === "denied";
  const alertsAvailable =
    notificationPermission !== "unsupported" && !alertsGranted && !alertsBlocked;

  return (
    <>
      <div
        className="sprint-card"
        data-status={sprint.status}
        data-completed={justCompleted ? "true" : undefined}
      >
        {/* ─── IDLE STATE ─── */}
        {sprint.status === "idle" && (
          <>
            {/* Timer display */}
            <div className="sprint-timer-display">
              <span className="sprint-timer-value">
                {formatCountdown(remainingMs)}
              </span>
            </div>

            {/* Duration presets + custom */}
            <div className="sprint-duration-row">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    setCustomMinutesInput(String(minutes));
                    applyDuration(minutes);
                  }}
                  className={`sprint-preset-chip ${selectedPreset === minutes ? "active" : ""}`}
                >
                  {minutes}m
                </button>
              ))}
              <div className="sprint-custom-duration">
                <button
                  type="button"
                  onClick={() => adjustCustomMinutes(-5)}
                  className="sprint-adjust-btn"
                  aria-label="Decrease duration"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customMinutesInput}
                  onChange={(event) => handleCustomMinutesChange(event.target.value)}
                  className="sprint-custom-input"
                  aria-label="Custom minutes"
                />
                <button
                  type="button"
                  onClick={() => adjustCustomMinutes(5)}
                  className="sprint-adjust-btn"
                  aria-label="Increase duration"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Category pills */}
            <div className="sprint-category-row">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => updateSprintConfig(cat.name)}
                  className={`sprint-cat-pill ${sprint.category === cat.name ? "active" : ""}`}
                >
                  <DynamicIcon name={cat.icon} className="w-3 h-3" />
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Start + Alert toggle */}
            <div className="sprint-start-row">
              <Button
                type="button"
                onClick={handleStart}
                className="sprint-start-btn v2-glow-btn"
              >
                <Play className="w-4 h-4 fill-current" />
                Start {formatMinutesLabel(sprint.plannedMinutes)}
              </Button>

              {/* Compact notification toggle */}
              <button
                type="button"
                onClick={alertsAvailable ? requestAlertPermission : undefined}
                className={`sprint-alert-toggle ${alertsGranted ? "granted" : ""}`}
                title={
                  alertsGranted
                    ? "Alerts enabled"
                    : alertsBlocked
                      ? "Alerts blocked in browser"
                      : "Enable finish alerts"
                }
                disabled={!alertsAvailable}
              >
                {alertsGranted ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </button>
            </div>

            {alertError && (
              <p className="sprint-alert-error">{alertError}</p>
            )}
          </>
        )}

        {/* ─── RUNNING / PAUSED STATE ─── */}
        {isSprintLive && (
          <>
            <div className="sprint-live-header">
              <span className="sprint-live-cat">{sprint.category}</span>
              <span className={`sprint-live-badge ${sprint.status === "running" ? "running" : "paused"}`}>
                {sprint.status === "running" ? "LIVE" : "PAUSED"}
              </span>
            </div>

            <div className="sprint-timer-display live">
              <span className="sprint-timer-value">
                {formatCountdown(remainingMs)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="sprint-progress-track">
              <div
                className="sprint-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="sprint-progress-meta">
              <span>{formatMinutesLabel(activeMinutes)} elapsed</span>
              <span>{formatMinutesLabel(sprint.plannedMinutes)} planned</span>
            </div>

            {/* Controls */}
            <div className="sprint-live-controls">
              {sprint.status === "running" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePause}
                    className="sprint-ctrl-btn outline"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    Pause
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFinishNow}
                    className="sprint-ctrl-btn finish"
                  >
                    <Flag className="w-4 h-4" />
                    Finish
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={handleResume}
                    className="sprint-ctrl-btn primary v2-glow-btn"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Resume
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFinishNow}
                    className="sprint-ctrl-btn finish"
                  >
                    <Flag className="w-4 h-4" />
                    Finish
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={resetToIdle}
                className="sprint-ctrl-btn cancel"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </Button>
            </div>
          </>
        )}

        {/* ─── COMPLETION STATE (card, before dialog) ─── */}
        {completionReady && (
          <>
            <div className="sprint-done-header">
              <CheckCircle2 className="w-4 h-4" style={{ color: "var(--v2-sage-400)" }} />
              <span>Sprint done</span>
              <span className="sprint-done-time">
                {roundElapsedMinutes(sprint.accumulatedActiveMs)}m / {sprint.plannedMinutes}m
              </span>
            </div>

            <div className="sprint-done-controls">
              <Button
                type="button"
                onClick={() => setIsDialogOpen(true)}
                className="sprint-ctrl-btn primary v2-glow-btn"
              >
                <Sparkles className="w-4 h-4" />
                Check In
              </Button>
              <div className="sprint-done-extend">
                <button
                  type="button"
                  onClick={() => handleAddMoreTime(5)}
                  className="sprint-extend-chip"
                >+5m</button>
                <button
                  type="button"
                  onClick={() => handleAddMoreTime(15)}
                  className="sprint-extend-chip"
                >+15m</button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={resetToIdle}
                className="sprint-ctrl-btn outline"
              >
                <TimerReset className="w-4 h-4" />
                Discard
              </Button>
            </div>
          </>
        )}

        {/* Saved summary toast */}
        {savedMeta && completionBullets.length > 0 && (
          <div className="sprint-saved-toast">
            <div className="sprint-saved-header">
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--v2-sage-400)" }} />
              <span>Logged</span>
              <span className="sprint-saved-meta">
                {savedMeta.actualMinutes}m / {savedMeta.plannedMinutes}m
              </span>
            </div>
            <ul className="sprint-saved-list">
              {completionBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ─── SPRINT CHECK-IN DIALOG ─── */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (isSaving) {
            return;
          }
          if (!open) {
            stopListening();
          }
          setIsDialogOpen(open);
        }}
      >
        <DialogContent
          className="sprint-dialog"
        >
          <div className="sprint-dialog-body">
            <DialogHeader className="sprint-dialog-header">
              <DialogTitle className="sprint-dialog-title">
                Sprint Check-in
              </DialogTitle>
              <DialogDescription className="sprint-dialog-desc">
                Capture what you shipped, then we&apos;ll summarize and file it.
              </DialogDescription>
            </DialogHeader>

            {/* Meta badges */}
            <div className="sprint-dialog-meta">
              <span className="sprint-meta-badge sage">
                {roundElapsedMinutes(sprint.accumulatedActiveMs)}m done
              </span>
              <span className="sprint-meta-badge muted">
                {sprint.plannedMinutes}m planned
              </span>
              <span className="sprint-meta-badge amber">
                {sprint.category}
              </span>
            </div>

            {/* Category selector */}
            <div className="sprint-dialog-cats">
              {categories.map((cat) => {
                const isActive = sprint.category === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => updateSprintConfig(cat.name)}
                    className={`sprint-dialog-cat-btn ${isActive ? "active" : ""}`}
                  >
                    <DynamicIcon name={cat.icon} className="w-3.5 h-3.5" />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Notes */}
            <div className="sprint-dialog-notes">
              <div className="sprint-dialog-notes-header">
                <span className="sprint-dialog-notes-count">
                  {sprint.checkInText.length}
                </span>
                {supported && (
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    className={`sprint-dialog-mic ${isListening ? "active" : ""}`}
                  >
                    {isListening ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                    {isListening ? "Stop" : "Dictate"}
                  </button>
                )}
              </div>

              <Textarea
                value={sprint.checkInText}
                onChange={(event) =>
                  setSprint((prev) =>
                    prev.status === "awaiting_checkin"
                      ? { ...prev, checkInText: event.target.value }
                      : prev
                  )
                }
                placeholder="What got done? Output, blockers, decisions…"
                className="sprint-dialog-textarea"
                style={{
                  borderColor: isListening
                    ? "var(--v2-amber-400)"
                    : "var(--v2-border)",
                }}
              />
            </div>

            {/* Error */}
            {saveError && (
              <div className="sprint-dialog-error">
                <AlertCircle className="w-4 h-4" style={{ color: "var(--v2-rose-400)" }} />
                <p>{saveError}</p>
              </div>
            )}

            {/* Need more time */}
            <div className="sprint-dialog-extend">
              <span className="sprint-dialog-extend-label">Need more time?</span>
              <div className="sprint-dialog-extend-btns">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleAddMoreTime(5)}
                  className="sprint-extend-chip"
                >+5m</button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleAddMoreTime(15)}
                  className="sprint-extend-chip"
                >+15m</button>
                <div className="sprint-dialog-extend-custom">
                  <Input
                    inputMode="numeric"
                    placeholder="m"
                    value={incrementMinutesInput}
                    disabled={isSaving}
                    onChange={(event) => setIncrementMinutesInput(event.target.value.replace(/[^\d]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCustomTime();
                    }}
                    className="sprint-dialog-extend-input"
                  />
                  <button
                    type="button"
                    disabled={!incrementMinutesInput || isSaving}
                    onClick={handleAddCustomTime}
                    className="sprint-dialog-extend-go"
                    style={{
                      background: !incrementMinutesInput ? "transparent" : "var(--v2-amber-500)",
                      color: !incrementMinutesInput ? "var(--v2-text-muted)" : "var(--v2-obsidian-900)"
                    }}
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="sprint-dialog-footer">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={resetToIdle}
              className="sprint-dialog-discard"
            >
              Discard
            </Button>
            <Button
              type="button"
              disabled={!sprint.checkInText.trim() || isSaving}
              onClick={handleSaveSprint}
              className="sprint-dialog-save v2-glow-btn"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isSaving ? "Saving…" : "Summarize & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
