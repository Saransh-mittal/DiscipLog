"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon from "@/components/DynamicIcon";

interface EditableLog {
  _id: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string;
  loggedAt?: string;
  createdAt?: string;
}

interface LogEditorDialogProps {
  log: EditableLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function formatDatetimeLocalValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function LogEditorDialog({
  log,
  open,
  onOpenChange,
  onSaved,
}: LogEditorDialogProps) {
  const { categories: userCategories } = useCategoriesContext();
  const [hours, setHours] = useState(String(log.hours));
  const [category, setCategory] = useState(log.category);
  const [loggedAt, setLoggedAt] = useState(
    formatDatetimeLocalValue(log.loggedAt || log.createdAt)
  );
  const [rawTranscript, setRawTranscript] = useState(log.rawTranscript);
  const [aiSummary, setAiSummary] = useState(log.aiSummary || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setHours(String(log.hours));
    setCategory(log.category);
    setLoggedAt(formatDatetimeLocalValue(log.loggedAt || log.createdAt));
    setRawTranscript(log.rawTranscript);
    setAiSummary(log.aiSummary || "");
    setErrorMessage("");
  }, [log, open]);

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const handleRegenerateSummary = async () => {
    if (!rawTranscript.trim() || isRegenerating) {
      return;
    }

    setIsRegenerating(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawTranscript.trim(),
          category,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setAiSummary(data.summary || "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to regenerate the summary."
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSave = async () => {
    const parsedHours = Number(hours);
    const parsedLoggedAt = new Date(loggedAt);

    if (
      !Number.isFinite(parsedHours) ||
      parsedHours <= 0 ||
      !rawTranscript.trim() ||
      Number.isNaN(parsedLoggedAt.getTime())
    ) {
      setErrorMessage("Fill in a valid duration, timestamp, and log content.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const res = await fetch(`/api/logs/${log._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: parsedHours,
          category,
          rawTranscript: rawTranscript.trim(),
          aiSummary,
          loggedAt: parsedLoggedAt.toISOString(),
          timezone,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save changes."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] flex-col sm:max-w-2xl p-0 overflow-hidden"
        style={{
          background: "var(--v2-surface)",
          borderColor: "var(--v2-border)",
          color: "var(--v2-text-primary)",
        }}
      >
        <div
          className="h-[2px] w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--v2-amber-500), var(--v2-amber-300), var(--v2-amber-500))",
          }}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-7 md:py-7 pr-4 md:pr-5 custom-scrollbar">
          <div className="space-y-6">
            <DialogHeader className="space-y-2">
              <DialogTitle
                style={{ fontFamily: "var(--font-display)" }}
                className="text-xl tracking-tight"
              >
                Edit Sprint Log
              </DialogTitle>
              <DialogDescription
                style={{
                  color: "var(--v2-text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Update the local timestamp, sprint duration, transcript, and
                summary. Times are shown in <strong>{timezone}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor={`category-${log._id}`}
                  style={{ color: "var(--v2-text-muted)" }}
                >
                  Category
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger
                    id={`category-${log._id}`}
                    className="w-full h-11 rounded-xl"
                    style={{
                      background: "var(--v2-obsidian-700)",
                      borderColor: "var(--v2-border)",
                      color: "var(--v2-text-primary)",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      background: "var(--v2-obsidian-700)",
                      borderColor: "var(--v2-border)",
                      color: "var(--v2-text-primary)",
                    }}
                  >
                    {userCategories.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor={`hours-${log._id}`}
                  style={{ color: "var(--v2-text-muted)" }}
                >
                  Sprint Duration (hours)
                </Label>
                <Input
                  id={`hours-${log._id}`}
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  className="h-11 rounded-xl"
                  style={{
                    background: "var(--v2-obsidian-700)",
                    borderColor: "var(--v2-border)",
                    color: "var(--v2-text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor={`logged-at-${log._id}`}
                style={{ color: "var(--v2-text-muted)" }}
              >
                Event Timestamp
              </Label>
              <Input
                id={`logged-at-${log._id}`}
                type="datetime-local"
                value={loggedAt}
                onChange={(event) => setLoggedAt(event.target.value)}
                className="h-11 rounded-xl"
                style={{
                  background: "var(--v2-obsidian-700)",
                  borderColor: "var(--v2-border)",
                  color: "var(--v2-text-primary)",
                }}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor={`transcript-${log._id}`}
                style={{ color: "var(--v2-text-muted)" }}
              >
                Log Content
              </Label>
              <Textarea
                id={`transcript-${log._id}`}
                value={rawTranscript}
                onChange={(event) => setRawTranscript(event.target.value)}
                className="min-h-[170px] rounded-xl resize-y"
                style={{
                  background: "var(--v2-obsidian-700)",
                  borderColor: "var(--v2-border)",
                  color: "var(--v2-text-primary)",
                }}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <Label
                    htmlFor={`summary-${log._id}`}
                    style={{ color: "var(--v2-text-muted)" }}
                  >
                    AI Summary
                  </Label>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--v2-text-secondary)" }}
                  >
                    Regenerate from the current draft, then tweak the summary
                    before saving if you want.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!rawTranscript.trim() || isRegenerating}
                  onClick={handleRegenerateSummary}
                  className="rounded-xl"
                  style={{
                    background: "var(--v2-obsidian-700)",
                    borderColor: "var(--v2-border-strong)",
                    color: "var(--v2-amber-300)",
                  }}
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isRegenerating ? "Regenerating..." : "Regenerate AI Summary"}
                </Button>
              </div>

              <Textarea
                id={`summary-${log._id}`}
                value={aiSummary}
                onChange={(event) => setAiSummary(event.target.value)}
                className="min-h-[140px] rounded-xl resize-y"
                style={{
                  background: "var(--v2-obsidian-700)",
                  borderColor: "var(--v2-border)",
                  color: "var(--v2-text-primary)",
                }}
              />
            </div>

            {errorMessage ? (
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "oklch(0.60 0.20 18 / 6%)",
                  borderColor: "oklch(0.60 0.20 18 / 20%)",
                  color: "var(--v2-rose-400)",
                }}
              >
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter
          className="border-t"
          style={{
            background: "var(--v2-obsidian-700)",
            borderColor: "var(--v2-border)",
          }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
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
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
              color: "var(--v2-obsidian-900)",
              border: "none",
            }}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
