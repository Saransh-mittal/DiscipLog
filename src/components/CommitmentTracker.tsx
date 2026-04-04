"use client";

import { useState, useEffect, useCallback } from "react";
import WorldCard from "@/components/WorldCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Check,
  X,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

interface Commitment {
  _id: string;
  text: string;
  weekStart: string;
  status: "pending" | "completed" | "missed";
  completedAt?: string;
  missedReason?: string;
  createdAt: string;
}

export default function CommitmentTracker() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [expandedMiss, setExpandedMiss] = useState<string | null>(null);
  const [missReason, setMissReason] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchCommitments = useCallback(async () => {
    try {
      const res = await fetch("/api/commitments");
      if (res.ok) {
        const data = await res.json();
        setCommitments(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText.trim() }),
      });
      if (res.ok) {
        setNewText("");
        setShowInput(false);
        fetchCommitments();
      }
    } catch {
    } finally {
      setAdding(false);
    }
  };

  const handleMarkComplete = async (id: string) => {
    setUpdatingId(id);
    try {
      await fetch("/api/commitments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitmentId: id, status: "completed" }),
      });
      fetchCommitments();
    } catch {
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkMissed = async (id: string) => {
    if (!missReason.trim()) return;
    setUpdatingId(id);
    try {
      await fetch("/api/commitments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commitmentId: id,
          status: "missed",
          rawReason: missReason.trim(),
        }),
      });
      setExpandedMiss(null);
      setMissReason("");
      fetchCommitments();
    } catch {
    } finally {
      setUpdatingId(null);
    }
  };

  const pending = commitments.filter((c) => c.status === "pending");
  const resolved = commitments.filter((c) => c.status !== "pending");

  return (
    <WorldCard
      className="relative overflow-hidden"
      style={{ padding: 0 }}
    >
      <div
        className="h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--world-accent, var(--v2-amber-500)), color-mix(in oklch, var(--world-accent, var(--v2-amber-300)) 80%, white), var(--world-accent, var(--v2-amber-500)))",
        }}
      />

      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target
              className="h-4 w-4"
              style={{ color: "var(--world-accent, var(--v2-amber-400))" }}
            />
            <h3
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Commitments
            </h3>
          </div>
          <button
            onClick={() => setShowInput((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: showInput
                ? "color-mix(in oklch, var(--world-accent) 10%, transparent)"
                : "var(--world-surface-raised, var(--v2-surface-raised))",
              color: showInput
                ? "var(--world-accent, var(--v2-amber-400))"
                : "var(--world-text-muted, var(--v2-text-muted))",
              fontFamily: "var(--font-body)",
            }}
          >
            {showInput ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Add
          </button>
        </div>

        {/* Add input */}
        {showInput && (
          <div className="mb-4 flex gap-2">
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Ship v1 of my app this week..."
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 h-10 rounded-lg border text-sm"
              style={{
                background: "var(--world-surface-raised, var(--v2-surface-raised))",
                borderColor: "var(--world-border, var(--v2-border))",
                color: "var(--world-text-primary, var(--v2-text-primary))",
                fontFamily: "var(--font-body)",
              }}
              autoFocus
            />
            <Button
              onClick={handleAdd}
              disabled={!newText.trim() || adding}
              className="h-10 rounded-lg px-4 text-xs font-bold"
              style={{
                background:
                  "linear-gradient(135deg, var(--world-accent, var(--v2-amber-500)), color-mix(in oklch, var(--world-accent, var(--v2-amber-600)) 80%, black))",
                color: "var(--v2-obsidian-900)",
                border: "none",
                fontFamily: "var(--font-body)",
              }}
            >
              {adding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Commit"
              )}
            </Button>
          </div>
        )}

        {/* Loading / empty */}
        {loading && (
          <div
            className="text-center py-6 text-sm"
            style={{
              color: "var(--world-text-muted, var(--v2-text-muted))",
              fontFamily: "var(--font-body)",
            }}
          >
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
          </div>
        )}

        {!loading && commitments.length === 0 && !showInput && (
          <p
            className="py-4 text-center text-sm"
            style={{
              color: "var(--world-text-muted, var(--v2-text-muted))",
              fontFamily: "var(--font-body)",
            }}
          >
            No commitments this week. Add one to track your goals.
          </p>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <div className="space-y-2.5 mb-4">
            {pending.map((c) => (
              <div
                key={c._id}
                className="rounded-lg border p-3.5 transition-colors"
                style={{
                  background: "var(--world-surface-raised, var(--v2-surface-raised))",
                  borderColor: "var(--world-border, var(--v2-border))",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="text-sm font-medium flex-1 pt-0.5"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "var(--world-text-primary, var(--v2-text-primary))",
                    }}
                  >
                    {c.text}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleMarkComplete(c._id)}
                      disabled={updatingId === c._id}
                      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                      style={{
                        background: "oklch(0.62 0.14 155 / 10%)",
                        color: "var(--v2-sage-400)",
                      }}
                      title="Mark complete"
                    >
                      {updatingId === c._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setExpandedMiss(
                          expandedMiss === c._id ? null : c._id
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                      style={{
                        background: "oklch(0.60 0.20 18 / 10%)",
                        color: "var(--v2-rose-400)",
                      }}
                      title="Mark missed"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Miss reason expansion */}
                {expandedMiss === c._id && (
                  <div className="mt-3 flex gap-2">
                    <Textarea
                      value={missReason}
                      onChange={(e) => setMissReason(e.target.value)}
                      placeholder="What got in the way?"
                      className="flex-1 min-h-[60px] resize-none rounded-lg border text-xs"
                      style={{
                        background: "var(--world-surface-raised, var(--v2-surface-overlay))",
                        borderColor: "var(--world-border, var(--v2-border))",
                        color: "var(--world-text-primary, var(--v2-text-primary))",
                        fontFamily: "var(--font-body)",
                      }}
                      autoFocus
                    />
                    <Button
                      onClick={() => handleMarkMissed(c._id)}
                      disabled={!missReason.trim() || updatingId === c._id}
                      className="h-auto self-end rounded-lg px-3 py-2 text-[10px] font-bold"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--world-accent, var(--v2-amber-500)), color-mix(in oklch, var(--world-accent, var(--v2-amber-600)) 80%, black))",
                        color: "var(--v2-obsidian-900)",
                        border: "none",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {updatingId === c._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Log
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Resolved */}
        {resolved.length > 0 && (
          <div className="space-y-2">
            {resolved.map((c) => (
              <div
                key={c._id}
                className="rounded-lg border p-3 flex items-start gap-3"
                style={{
                  background: "var(--world-surface-raised, var(--v2-surface-raised))",
                  borderColor:
                    c.status === "completed"
                      ? "oklch(0.62 0.14 155 / 15%)"
                      : "oklch(0.60 0.20 18 / 15%)",
                  opacity: 0.75,
                }}
              >
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 mt-0.5 flex-shrink-0"
                  style={{
                    borderColor:
                      c.status === "completed"
                        ? "oklch(0.62 0.14 155 / 25%)"
                        : "oklch(0.60 0.20 18 / 25%)",
                    color:
                      c.status === "completed"
                        ? "var(--v2-sage-400)"
                        : "var(--v2-rose-400)",
                    background:
                      c.status === "completed"
                        ? "oklch(0.62 0.14 155 / 5%)"
                        : "oklch(0.60 0.20 18 / 5%)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {c.status === "completed" ? "Done" : "Missed"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm line-through"
                    style={{
                      color: "var(--world-text-muted, var(--v2-text-muted))",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {c.text}
                  </p>
                  {c.missedReason && (
                    <p
                      className="text-xs mt-1 italic"
                      style={{
                        color: "var(--world-text-secondary, var(--v2-text-secondary))",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {c.missedReason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WorldCard>
  );
}
