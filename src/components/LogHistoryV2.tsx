"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Inbox,
  Loader2,
  Pencil,
  TimerReset,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LogEditorDialog from "@/components/LogEditorDialog";
import {
  formatLocalDate,
  getLogTimestampValue,
  type DashboardLog,
} from "@/lib/logs";

type LogItem = DashboardLog;

interface LogHistoryV2Props {
  logs: LogItem[];
  loading: boolean;
  refreshLogs?: () => void;
}

function renderMarkdown(text: string) {
  if (!text) return "";

  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?:^|\s+)([\*\-])\s+/g, "\n$1 ");

  const lines = html.split("\n").filter((line) => line.trim().length > 0);
  let inList = false;
  let finalHtml = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (!inList) {
        finalHtml +=
          '<ul class="list-disc pl-4 space-y-1.5 mt-2 opacity-90" style="color: var(--v2-text-primary);">\n';
        inList = true;
      }
      finalHtml += `<li>${trimmed.substring(2)}</li>\n`;
    } else {
      if (inList) {
        finalHtml += "</ul>\n";
        inList = false;
      }
      finalHtml += `<p class="mb-2 leading-relaxed">${trimmed}</p>\n`;
    }
  }

  if (inList) {
    finalHtml += "</ul>\n";
  }

  return finalHtml;
}

function getSummaryFallback(log: LogItem) {
  if (log.rawTranscript) {
    const stripped = log.rawTranscript.replace(/[#*`>]/g, "").trim();
    if (stripped.length > 200) {
      return `${stripped.slice(0, 200)}...`;
    }
    return stripped;
  }
  return "No transcript or summary generated.";
}

function formatDateTime(log: LogItem) {
  try {
    const eventDate = getLogTimestampValue(log);
    if (!eventDate) {
      return log.date;
    }

    return eventDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return log.date;
  }
}

function formatSprintMeta(log: LogItem) {
  if (log.source !== "sprint" || !log.actualMinutes) {
    return null;
  }

  if (log.plannedMinutes) {
    return `${log.actualMinutes}m / ${log.plannedMinutes}m`;
  }

  return `${log.actualMinutes}m`;
}

function getCategoryColor(category: string) {
  if (category === "Shipping") {
    return {
      bg: "oklch(0.62 0.14 155 / 10%)",
      text: "var(--v2-sage-400)",
      border: "oklch(0.62 0.14 155 / 25%)",
    };
  }

  return {
    bg: "oklch(0.65 0.19 60 / 10%)",
    text: "var(--v2-amber-400)",
    border: "oklch(0.65 0.19 60 / 25%)",
  };
}

function LogCard({
  log,
  onRefresh,
}: {
  log: LogItem;
  onRefresh?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const catStyle = getCategoryColor(log.category);

  const handleDelete = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/logs/${log._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setIsDeleteOpen(false);
      onRefresh?.();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete log."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card
        className="p-4 border transition-all hover:bg-[var(--v2-obsidian-600)]"
        style={{
          background: "var(--v2-surface)",
          borderColor: "var(--v2-border)",
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="outline"
                  style={{
                    background: catStyle.bg,
                    color: catStyle.text,
                    borderColor: catStyle.border,
                  }}
                >
                  {log.category}
                </Badge>
                {log.source === "sprint" ? (
                  <Badge
                    variant="outline"
                    style={{
                      background: "oklch(0.65 0.19 60 / 6%)",
                      color: "var(--v2-amber-300)",
                      borderColor: "oklch(0.65 0.19 60 / 20%)",
                    }}
                  >
                    Sprint
                  </Badge>
                ) : null}
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--v2-text-muted)" }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono">{log.hours}h</span>
                </div>
                {formatSprintMeta(log) ? (
                  <div
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: "var(--v2-text-muted)" }}
                  >
                    <TimerReset className="w-3.5 h-3.5" />
                    <span className="font-mono">{formatSprintMeta(log)}</span>
                  </div>
                ) : null}
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "var(--v2-text-muted)" }}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span className="font-mono">{formatDateTime(log)}</span>
                </div>
              </div>

              {log.aiSummary ? (
                <div
                  className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none"
                  style={{ color: "var(--v2-text-secondary)" }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(log.aiSummary) }}
                />
              ) : (
                <div className="space-y-3 mt-2">
                  <div
                    className="text-sm leading-relaxed italic"
                    style={{ color: "var(--v2-text-muted)" }}
                  >
                    {getSummaryFallback(log)}
                  </div>
                  <p
                    className="text-xs uppercase tracking-[0.18em]"
                    style={{ color: "var(--v2-amber-400)" }}
                  >
                    Open editor to generate or customize the summary.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditorOpen(true)}
                className="rounded-xl"
                style={{
                  background: "var(--v2-surface-raised)",
                  borderColor: "var(--v2-border-strong)",
                  color: "var(--v2-text-secondary)",
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteOpen(true)}
                className="rounded-xl"
                style={{
                  background: "transparent",
                  borderColor: "oklch(0.60 0.20 18 / 20%)",
                  color: "var(--v2-rose-400)",
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </div>
          </div>

          {log.rawTranscript ? (
            <div className="pt-4 border-t" style={{ borderColor: "var(--v2-border)" }}>
              <button
                onClick={() => setIsExpanded((value) => !value)}
                className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold transition-colors hover:text-[var(--v2-text-primary)]"
                style={{ color: "var(--v2-text-muted)" }}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                [ {isExpanded ? "Hide" : "View"} Raw Transcript ]
              </button>

              {isExpanded ? (
                <div
                  className="mt-3 p-4 rounded-md font-mono text-xs whitespace-pre-wrap leading-relaxed border"
                  style={{
                    background: "var(--v2-surface-overlay)",
                    color: "var(--v2-text-muted)",
                    borderColor: "var(--v2-border)",
                  }}
                >
                  {log.rawTranscript}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <LogEditorDialog
        log={log}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSaved={onRefresh || (() => {})}
      />

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent
          className="sm:max-w-md"
          style={{
            background: "var(--v2-surface)",
            borderColor: "var(--v2-border)",
            color: "var(--v2-text-primary)",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
              Delete Log?
            </DialogTitle>
            <DialogDescription
              style={{
                color: "var(--v2-text-secondary)",
                fontFamily: "var(--font-body)",
              }}
            >
              This permanently removes the sprint log, its edited timestamp, and
              its summary from your dashboard.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                background: "oklch(0.60 0.20 18 / 6%)",
                borderColor: "oklch(0.60 0.20 18 / 20%)",
                color: "var(--v2-rose-400)",
              }}
            >
              {deleteError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-xl"
              style={{
                background: "transparent",
                borderColor: "var(--v2-border)",
                color: "var(--v2-text-secondary)",
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isDeleting ? "Deleting..." : "Delete Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function LogHistoryV2({
  logs,
  loading,
  refreshLogs,
}: LogHistoryV2Props) {
  const [activeTab, setActiveTab] = useState("all");

  const today = formatLocalDate(new Date());
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekThreshold = formatLocalDate(sevenDaysAgo);

  const filteredLogs = useMemo(() => {
    const nextLogs = logs.filter((log) => {
      if (activeTab === "all") return true;
      if (activeTab === "today") return log.date === today;
      if (activeTab === "week") return log.date >= weekThreshold;
      return true;
    });

    nextLogs.sort((a, b) => {
      const timeA = getLogTimestampValue(a)?.getTime() ?? 0;
      const timeB = getLogTimestampValue(b)?.getTime() ?? 0;
      return timeB - timeA;
    });

    return nextLogs;
  }, [activeTab, logs, today, weekThreshold]);

  if (loading) {
    return (
      <Card
        className="p-8 border flex items-center justify-center min-h-[300px]"
        style={{
          background: "var(--v2-surface)",
          borderColor: "var(--v2-border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--v2-text-muted)" }}>
          Loading history...
        </p>
      </Card>
    );
  }

  return (
    <Card
      className="p-6 md:p-8 border shadow-sm relative overflow-hidden"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight mb-1"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--v2-text-primary)",
            }}
          >
            Terminal Ledger
          </h2>
          <p
            className="text-sm"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--v2-text-secondary)",
            }}
          >
            Historical records of your focus blocks.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList
            className="border"
            style={{
              background: "var(--v2-surface-overlay)",
              borderColor: "var(--v2-border)",
            }}
          >
            <TabsTrigger value="all" className="data-[state=active]:bg-[var(--v2-surface)] data-[state=active]:text-[var(--v2-amber-300)]">
              All Sessions
            </TabsTrigger>
            <TabsTrigger value="week" className="data-[state=active]:bg-[var(--v2-surface)] data-[state=active]:text-[var(--v2-amber-300)]">
              This Week
            </TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-[var(--v2-surface)] data-[state=active]:text-[var(--v2-amber-300)]">
              Today
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-10 h-10 mb-4" style={{ color: "var(--v2-obsidian-300)" }} />
            <p style={{ color: "var(--v2-text-muted)" }}>
              No logs found for this timeframe.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <LogCard key={log._id} log={log} onRefresh={refreshLogs} />
          ))
        )}
      </div>
    </Card>
  );
}
