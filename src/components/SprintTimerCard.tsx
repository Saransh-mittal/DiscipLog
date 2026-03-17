"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon from "@/components/DynamicIcon";
import {
  type SprintCompletionStatus,
} from "@/lib/logs";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Clock3,
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
  Volume2,
} from "lucide-react";

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

  return (
    <>
      <Card
        className="relative overflow-hidden border p-0"
        style={{
          background: justCompleted
            ? "linear-gradient(180deg, oklch(0.16 0.01 260), oklch(0.12 0.008 260))"
            : "var(--v2-surface)",
          borderColor: completionReady
            ? "oklch(0.65 0.19 60 / 25%)"
            : "var(--v2-border)",
          boxShadow: completionReady
            ? "0 0 0 1px oklch(0.65 0.19 60 / 12%), 0 24px 60px oklch(0 0 0 / 24%)"
            : "none",
        }}
      >
        <div
          className="h-[2px] w-full"
          style={{
            background:
              sprint.status === "running"
                ? "linear-gradient(90deg, var(--v2-amber-600), var(--v2-amber-300), var(--v2-amber-500))"
                : "linear-gradient(90deg, var(--v2-sage-500), var(--v2-amber-300), var(--v2-amber-500))",
          }}
        />

        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="text-[10px] px-2.5 py-1 border"
                  style={{
                    borderColor: "oklch(0.65 0.19 60 / 18%)",
                    color: "var(--v2-amber-300)",
                    background: "oklch(0.65 0.19 60 / 6%)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Eggtimer Sprint
                </Badge>
                {completionReady && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2.5 py-1 border"
                    style={{
                      borderColor: "oklch(0.62 0.14 155 / 22%)",
                      color: "var(--v2-sage-400)",
                      background: "oklch(0.62 0.14 155 / 6%)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Ready To Log
                  </Badge>
                )}
              </div>
              <h3
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Sprint Mode
              </h3>
              <p
                className="text-sm mt-1 max-w-sm leading-relaxed"
                style={{
                  color: "var(--v2-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Run a focused block here, then capture what you shipped before the momentum cools.
              </p>
            </div>

            <div
              className="rounded-2xl border px-4 py-3 min-w-[128px]"
              style={{
                borderColor: completionReady
                  ? "oklch(0.65 0.19 60 / 22%)"
                  : "var(--v2-border)",
                background: "var(--v2-surface-raised)",
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1"
                style={{
                  color: "var(--v2-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Remaining
              </div>
              <div
                className="text-3xl font-bold tracking-tight tabular-nums"
                style={{
                  fontFamily: "var(--font-display)",
                  color: completionReady
                    ? "var(--v2-sage-400)"
                    : "var(--v2-amber-300)",
                }}
              >
                {formatCountdown(remainingMs)}
              </div>
            </div>
          </div>

          <div
            className="mb-6 rounded-2xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            style={{
              background: "var(--v2-surface-raised)",
              borderColor:
                notificationPermission === "granted"
                  ? "oklch(0.62 0.14 155 / 22%)"
                  : "var(--v2-border)",
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {notificationPermission === "granted" ? (
                  <Bell
                    className="w-4 h-4"
                    style={{ color: "var(--v2-sage-400)" }}
                  />
                ) : (
                  <BellOff
                    className="w-4 h-4"
                    style={{ color: "var(--v2-amber-300)" }}
                  />
                )}
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: "var(--v2-text-primary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Finish alerts
                </span>
              </div>
              <p
                className="text-xs leading-relaxed max-w-md"
                style={{
                  color: "var(--v2-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                The timer beeps when it ends. Enable browser alerts too if you want a permission-based reminder while the tab is in the background.
              </p>
              {notificationPermission === "denied" ? (
                <p
                  className="text-xs mt-2"
                  style={{
                    color: "var(--v2-amber-300)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Browser alerts are currently blocked for this site. The beep will still work here, and you can re-enable notifications from your browser or site settings.
                </p>
              ) : null}
              {alertError ? (
                <p
                  className="text-xs mt-2"
                  style={{
                    color: "var(--v2-rose-400)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {alertError}
                </p>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={
                sprint.status !== "idle" ||
                notificationPermission === "unsupported" ||
                notificationPermission === "granted" ||
                notificationPermission === "denied"
              }
              onClick={requestAlertPermission}
              className="rounded-xl h-11 px-4 font-semibold"
              style={{
                borderColor:
                  notificationPermission === "granted"
                    ? "oklch(0.62 0.14 155 / 24%)"
                    : "var(--v2-border-strong)",
                background:
                  notificationPermission === "granted"
                    ? "oklch(0.62 0.14 155 / 8%)"
                    : "transparent",
                color:
                  notificationPermission === "granted"
                    ? "var(--v2-sage-400)"
                    : "var(--v2-text-secondary)",
                fontFamily: "var(--font-body)",
              }}
            >
              <Volume2 className="w-4 h-4" />
              {notificationPermission === "granted"
                ? "Alerts Enabled"
                : notificationPermission === "denied"
                  ? "Alerts Blocked"
                : notificationPermission === "unsupported"
                  ? "Alerts Unavailable"
                  : "Enable Alerts"}
            </Button>
          </div>

          {sprint.status !== "idle" ? (
            <div
              className="rounded-[24px] border p-5 mb-6 overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, oklch(0.16 0.01 260), oklch(0.12 0.008 260))",
                borderColor: "var(--v2-border)",
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1"
                    style={{
                      color: "var(--v2-text-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Session Pulse
                  </p>
                  <div
                    className="text-sm"
                    style={{
                      color: "var(--v2-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {completionReady
                      ? "Timer complete. Capture the result while it is fresh."
                      : `${formatMinutesLabel(activeMinutes)} logged so far`}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock3
                    className="w-4 h-4"
                    style={{
                      color: completionReady
                        ? "var(--v2-sage-400)"
                        : "var(--v2-amber-400)",
                    }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.15em]"
                    style={{
                      color: completionReady
                        ? "var(--v2-sage-400)"
                        : sprint.status === "running"
                          ? "var(--v2-amber-300)"
                          : "var(--v2-text-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {completionReady
                      ? "check-in"
                      : sprint.status === "running"
                        ? "live"
                        : "paused"}
                  </span>
                </div>
              </div>

              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "var(--v2-surface-raised)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: completionReady
                      ? "linear-gradient(90deg, var(--v2-sage-500), var(--v2-sage-400))"
                      : "linear-gradient(90deg, var(--v2-amber-600), var(--v2-amber-300))",
                    boxShadow: completionReady
                      ? "0 0 20px oklch(0.62 0.14 155 / 30%)"
                      : "0 0 24px oklch(0.65 0.19 60 / 24%)",
                  }}
                />
              </div>

              <div
                className="mt-4 flex items-center justify-between text-[11px] font-semibold"
                style={{
                  color: "var(--v2-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                <span>{formatMinutesLabel(roundElapsedMinutes(elapsedMs))} elapsed</span>
                <span>{formatMinutesLabel(sprint.plannedMinutes)} planned</span>
              </div>
            </div>
          ) : null}

          <div className="mb-6">
            <label
              className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 block"
              style={{
                color: "var(--v2-text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              Duration
            </label>
            <div
              className="rounded-2xl border p-4"
              style={{
                background:
                  selectedPreset === null
                    ? "oklch(0.65 0.19 60 / 6%)"
                    : "var(--v2-surface-raised)",
                borderColor:
                  selectedPreset === null
                    ? "oklch(0.65 0.19 60 / 20%)"
                    : "var(--v2-border-strong)",
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: "var(--v2-text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Sprint
                  </p>
                  <p
                    className="text-xs"
                    style={{
                      color: "var(--v2-text-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Set any duration between {MIN_CUSTOM_MINUTES} and {MAX_CUSTOM_MINUTES} minutes.
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                  style={{
                    color:
                      selectedPreset === null
                        ? "var(--v2-amber-300)"
                        : "var(--v2-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {formatMinutesLabel(sprint.plannedMinutes)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sprint.status !== "idle"}
                  onClick={() => adjustCustomMinutes(-1)}
                  className="h-11 w-11 rounded-xl border"
                  style={{
                    borderColor: "var(--v2-border-strong)",
                    background: "var(--v2-surface-overlay)",
                    color: "var(--v2-text-secondary)",
                  }}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  inputMode="numeric"
                  placeholder="Minutes"
                  value={customMinutesInput}
                  disabled={sprint.status !== "idle"}
                  onChange={(event) => handleCustomMinutesChange(event.target.value)}
                  className="h-11 rounded-xl border text-sm text-center"
                  style={{
                    background: "var(--v2-surface-raised)",
                    borderColor:
                      selectedPreset === null && customMinutesInput
                        ? "oklch(0.65 0.19 60 / 24%)"
                        : "var(--v2-border-strong)",
                    color: "var(--v2-text-primary)",
                    fontFamily: "var(--font-body)",
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={sprint.status !== "idle"}
                  onClick={() => adjustCustomMinutes(1)}
                  className="h-11 w-11 rounded-xl border"
                  style={{
                    borderColor: "var(--v2-border-strong)",
                    background: "var(--v2-surface-overlay)",
                    color: "var(--v2-text-secondary)",
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <p
                className="text-[11px] mt-3"
                style={{
                  color: "var(--v2-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Quick sprints:{" "}
                <span style={{ color: "var(--v2-amber-300)" }}>
                  tap a preset below or type your own time above.
                </span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              {DURATION_PRESETS.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  variant="outline"
                  disabled={sprint.status !== "idle"}
                  onClick={() => {
                    setCustomMinutesInput(String(minutes));
                    applyDuration(minutes);
                  }}
                  className="h-10 rounded-xl border text-xs font-semibold disabled:opacity-50"
                  style={{
                    borderColor:
                      selectedPreset === minutes
                        ? "oklch(0.65 0.19 60 / 24%)"
                        : "var(--v2-border-strong)",
                    background:
                      selectedPreset === minutes
                        ? "oklch(0.65 0.19 60 / 8%)"
                        : "var(--v2-surface-raised)",
                    color:
                      selectedPreset === minutes
                        ? "var(--v2-amber-300)"
                        : "var(--v2-text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {minutes}m
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {sprint.status === "idle" && (
              <Button
                type="button"
                onClick={handleStart}
                className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 v2-glow-btn"
                style={{
                  background:
                    "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
                  color: "var(--v2-obsidian-900)",
                  fontFamily: "var(--font-body)",
                  border: "none",
                }}
              >
                <Play className="w-4 h-4 fill-current" />
                Start {formatMinutesLabel(sprint.plannedMinutes)} Sprint
              </Button>
            )}

            {sprint.status === "running" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePause}
                  className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 border"
                  style={{
                    borderColor: "var(--v2-border-strong)",
                    background: "var(--v2-surface-raised)",
                    color: "var(--v2-text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <Pause className="w-4 h-4 fill-current" />
                  Pause
                </Button>
                <Button
                  type="button"
                  onClick={handleFinishNow}
                  className="flex-1 h-12 rounded-xl font-bold text-sm gap-2"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.62 0.14 155), oklch(0.56 0.13 155))",
                    color: "var(--v2-obsidian-900)",
                    fontFamily: "var(--font-body)",
                    border: "none",
                  }}
                >
                  <Flag className="w-4 h-4" />
                  Finish Now
                </Button>
              </>
            )}

            {sprint.status === "paused" && (
              <>
                <Button
                  type="button"
                  onClick={handleResume}
                  className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 v2-glow-btn"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
                    color: "var(--v2-obsidian-900)",
                    fontFamily: "var(--font-body)",
                    border: "none",
                  }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Resume
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFinishNow}
                  className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 border"
                  style={{
                    borderColor: "oklch(0.62 0.14 155 / 24%)",
                    background: "oklch(0.62 0.14 155 / 8%)",
                    color: "var(--v2-sage-400)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <Flag className="w-4 h-4" />
                  Finish Now
                </Button>
              </>
            )}

            {completionReady && (
              <>
                <Button
                  type="button"
                  onClick={() => setIsDialogOpen(true)}
                  className="flex-1 h-12 rounded-xl font-bold text-sm gap-2"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--v2-sage-500), var(--v2-sage-400))",
                    color: "var(--v2-obsidian-900)",
                    fontFamily: "var(--font-body)",
                    border: "none",
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Add Check-In
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetToIdle}
                  className="flex-1 h-12 rounded-xl font-bold text-sm gap-2 border"
                  style={{
                    borderColor: "var(--v2-border-strong)",
                    background: "var(--v2-surface-raised)",
                    color: "var(--v2-text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <TimerReset className="w-4 h-4" />
                  Discard Draft
                </Button>
              </>
            )}

            {isSprintLive && (
              <Button
                type="button"
                variant="outline"
                onClick={resetToIdle}
                className="h-12 rounded-xl font-bold text-sm gap-2 border"
                style={{
                  borderColor: "oklch(0.60 0.20 18 / 24%)",
                  background: "oklch(0.60 0.20 18 / 7%)",
                  color: "var(--v2-rose-400)",
                  fontFamily: "var(--font-body)",
                }}
              >
                <Square className="w-4 h-4 fill-current" />
                Cancel
              </Button>
            )}
          </div>

          {completionReady && !isDialogOpen && (
            <div
              className="mt-5 rounded-2xl border p-4"
              style={{
                borderColor: "oklch(0.65 0.19 60 / 18%)",
                background: "oklch(0.65 0.19 60 / 5%)",
              }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="w-4 h-4 mt-0.5"
                  style={{ color: "var(--v2-sage-400)" }}
                />
                <div>
                  <p
                    className="text-sm font-semibold mb-1"
                    style={{
                      color: "var(--v2-text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Sprint complete. Your draft is being held here.
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{
                      color: "var(--v2-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Re-open the check-in dialog anytime. The note stays recoverable until you save or discard it.
                  </p>
                </div>
              </div>
            </div>
          )}

          {savedMeta && completionBullets.length > 0 && (
            <div
              className="mt-6 border-t px-0 pt-5"
              style={{ borderColor: "oklch(0.62 0.14 155 / 20%)" }}
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
                  Sprint Logged
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                  style={{
                    color: "var(--v2-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {savedMeta.actualMinutes}m / {savedMeta.plannedMinutes}m
                </span>
              </div>
              <ul
                className="text-sm space-y-1.5 list-disc list-inside"
                style={{
                  color: "var(--v2-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {completionBullets.map((bullet) => (
                  <li key={bullet} className="leading-relaxed pl-1">
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

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
          className="max-w-2xl border p-0 overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.16 0.01 260), oklch(0.12 0.008 260))",
            borderColor: "var(--v2-border)",
          }}
        >
          <div className="p-6 md:p-7">
            <DialogHeader className="mb-5">
              <DialogTitle
                className="text-xl md:text-2xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: "var(--v2-text-primary)" }}
              >
                What did you finish in this sprint?
              </DialogTitle>
              <DialogDescription
                className="max-w-xl text-base leading-relaxed"
                style={{
                  color: "var(--v2-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Capture the outcome, then DiscipLog will summarize and file it automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 mb-5">
              <Badge
                variant="outline"
                className="px-3 py-1.5 border"
                style={{
                  borderColor: "var(--v2-border)",
                  background: "var(--v2-surface-raised)",
                  color: "var(--v2-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Planned: {sprint.plannedMinutes}m
              </Badge>
              <Badge
                variant="outline"
                className="px-3 py-1.5 border"
                style={{
                  borderColor: "oklch(0.65 0.19 60 / 20%)",
                  background: "oklch(0.65 0.19 60 / 8%)",
                  color: "var(--v2-amber-300)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {sprint.category}
              </Badge>
            </div>

            <div className="mb-6">
              <label
                className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 block"
                style={{
                  color: "var(--v2-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Sprint Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {categories.map((cat) => {
                  const isActive = sprint.category === cat.name;

                  return (
                    <Button
                      key={cat.name}
                      type="button"
                      variant="outline"
                      onClick={() => updateSprintConfig(cat.name)}
                      className="h-11 rounded-xl justify-center border text-xs sm:text-sm font-semibold gap-1.5"
                      style={{
                        borderColor: isActive
                          ? "oklch(0.65 0.19 60 / 24%)"
                          : "var(--v2-border-strong)",
                        background: isActive
                          ? "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-400))"
                          : "var(--v2-surface-raised)",
                        color: isActive
                          ? "var(--v2-obsidian-900)"
                          : "var(--v2-text-secondary)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      <DynamicIcon name={cat.icon} className="w-3.5 h-3.5" />
                      {cat.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="mb-2">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <label
                  className="text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{
                    color: "var(--v2-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Sprint Notes
                </label>

                <div className="flex items-center gap-2 ml-auto">
                  <span
                    className="text-[11px] font-medium"
                    style={{
                      color: "var(--v2-obsidian-300)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {sprint.checkInText.length} chars
                  </span>
                  {supported && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleVoiceToggle}
                      className="rounded-xl border px-3"
                      style={{
                        borderColor: isListening
                          ? "var(--v2-amber-400)"
                          : "var(--v2-border-strong)",
                        background: isListening
                          ? "oklch(0.65 0.19 60 / 8%)"
                          : "var(--v2-surface-raised)",
                        color: isListening
                          ? "var(--v2-amber-300)"
                          : "var(--v2-text-secondary)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {isListening ? (
                        <Square className="w-4 h-4 fill-current" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                      {isListening ? "Stop" : "Dictate"}
                    </Button>
                  )}
                </div>
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
                placeholder="What got done? Mention output, blockers, decisions, or what changed."
                className="min-h-[220px] resize-none rounded-2xl border text-base leading-relaxed"
                style={{
                  background: "var(--v2-surface-raised)",
                  borderColor: isListening
                    ? "var(--v2-amber-400)"
                    : "var(--v2-border)",
                  color: "var(--v2-text-primary)",
                  fontFamily: "var(--font-body)",
                }}
              />
            </div>

            {saveError && (
              <div
                className="mt-4 rounded-2xl border px-4 py-3 flex items-start gap-3"
                style={{
                  borderColor: "oklch(0.60 0.20 18 / 20%)",
                  background: "oklch(0.60 0.20 18 / 5%)",
                }}
              >
                <AlertCircle
                  className="w-4 h-4 mt-0.5"
                  style={{ color: "var(--v2-rose-400)" }}
                />
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: "var(--v2-text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {saveError}
                </p>
              </div>
            )}
          </div>

          <DialogFooter
            className="border-t"
            style={{
              borderColor: "var(--v2-border)",
              background: "oklch(0.10 0.006 260 / 60%)",
            }}
          >
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={resetToIdle}
              style={{
                borderColor: "var(--v2-border-strong)",
                background: "var(--v2-surface-raised)",
                color: "var(--v2-text-secondary)",
                fontFamily: "var(--font-body)",
              }}
            >
              Discard Draft
            </Button>
            <Button
              type="button"
              disabled={!sprint.checkInText.trim() || isSaving}
              onClick={handleSaveSprint}
              style={{
                background:
                  "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
                color: "var(--v2-obsidian-900)",
                fontFamily: "var(--font-body)",
                border: "none",
              }}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isSaving ? "Summarizing..." : "Summarize & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
