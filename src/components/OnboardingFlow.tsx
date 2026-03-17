"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ArrowRight,
  Check,
  Sparkles,
  X,
  Plus,
  Mic,
  Square,
} from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { UserCategory } from "@/lib/logs";

interface OnboardingFlowProps {
  userName?: string;
}

export default function OnboardingFlow({ userName }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const {
    isListening,
    transcript: description,
    setTranscript: setDescription,
    startListening,
    stopListening,
    supported,
  } = useSpeechRecognition();
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setCategories(data.categories);
      setStep(2);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (categories.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (index: number, field: keyof UserCategory, value: string | number | boolean) => {
    setCategories((prev) =>
      prev.map((cat, i) => {
        if (i !== index) return cat;
        
        const updatedCat = { ...cat, [field]: value };
        
        // Auto-adjust weekly targets when daily target changes
        if (field === "dailyTargetHours") {
          const daily = Number(value) || 0;
          updatedCat.weeklyMinTarget = daily * 5;
          updatedCat.weeklyMaxTarget = daily * 7;
        }
        
        return updatedCat;
      })
    );
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const addCategory = () => {
    if (categories.length >= 7) return;
    setCategories((prev) => [
      ...prev,
      {
        name: "",
        dailyTargetHours: 1,
        weeklyMinTarget: 5,
        weeklyMaxTarget: 7,
        icon: "Target",
        isSideCategory: false,
      },
    ]);
  };

  return (
    <div
      className="v2 flex min-h-screen flex-col items-center justify-center px-6 py-12 selection:bg-[oklch(0.65_0.19_60_/_30%)]"
    >
      <div className="v2-accent-line fixed top-0 left-0 w-full" />

      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="v2-stagger-in v2-stagger-1 mb-10 text-center">
          <h1
            className="text-4xl font-extrabold tracking-tighter md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Discip<span style={{ color: "var(--v2-amber-400)" }}>Log</span>
          </h1>
        </div>

        {step === 1 && (
          <div className="v2-stagger-in v2-stagger-2">
            <Card
              className="relative overflow-hidden border p-0"
              style={{
                background: "var(--v2-surface)",
                borderColor: "var(--v2-border)",
              }}
            >
              <div
                className="h-[2px] w-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--v2-amber-500), var(--v2-amber-300), var(--v2-amber-500))",
                }}
              />

              <div className="p-8 md:p-10">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: "var(--v2-amber-400)" }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{
                      color: "var(--v2-amber-400)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    AI Setup
                  </span>
                </div>

                <h2
                  className="mb-2 text-2xl font-bold tracking-tight md:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  What do you spend your time on?
                </h2>
                <p
                  className="mb-8 text-sm leading-relaxed"
                  style={{
                    color: "var(--v2-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Describe your daily activities in your own words.
                </p>

                <div className="relative mb-6">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      isListening
                        ? "Listening..."
                        : "e.g. I prep for interviews, build side projects, learn new tech, and exercise..."
                    }
                    className="min-h-[140px] w-full resize-none rounded-xl border text-sm leading-relaxed"
                    style={{
                      background: "var(--v2-surface-raised)",
                      borderColor: isListening ? "var(--v2-amber-400)" : "var(--v2-border)",
                      color: "var(--v2-text-primary)",
                      fontFamily: "var(--font-body)",
                      boxShadow: isListening ? "0 0 30px oklch(0.65 0.19 60 / 10%)" : "none",
                      transition: "all 0.3s ease",
                    }}
                    autoFocus
                  />
                  
                  {isListening && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-3 pointer-events-none">
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

                  {supported && (
                    <Button
                      type="button"
                      onClick={isListening ? stopListening : startListening}
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-3 right-3 h-8 w-8 rounded-lg transition-all"
                      style={{
                        background: isListening
                          ? "oklch(0.65 0.19 60 / 15%)"
                          : "var(--v2-surface-overlay)",
                        color: isListening
                          ? "var(--v2-amber-400)"
                          : "var(--v2-text-muted)",
                      }}
                    >
                      {isListening ? (
                        <Square className="h-4 w-4 fill-current animate-pulse" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {error && (
                  <p
                    className="mb-4 text-sm"
                    style={{ color: "var(--v2-rose-400)" }}
                  >
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={!description.trim() || loading}
                  className="h-12 w-full rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40 v2-glow-btn"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
                    color: "var(--v2-obsidian-900)",
                    fontFamily: "var(--font-body)",
                    border: "none",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Categories
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="v2-stagger-in v2-stagger-2">
            <Card
              className="relative overflow-hidden border p-0"
              style={{
                background: "var(--v2-surface)",
                borderColor: "var(--v2-border)",
              }}
            >
              <div
                className="h-[2px] w-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--v2-amber-500), var(--v2-amber-300), var(--v2-amber-500))",
                }}
              />

              <div className="p-8 md:p-10">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: "var(--v2-amber-400)" }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{
                      color: "var(--v2-amber-400)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Your Plan
                  </span>
                </div>

                <h2
                  className="mb-1 text-2xl font-bold tracking-tight md:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Review & Adjust
                </h2>
                <p
                  className="mb-6 text-sm"
                  style={{
                    color: "var(--v2-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Tap any value to edit.{" "}
                  <span style={{ color: "var(--v2-text-secondary)" }}>
                    {categories.length}/7 categories
                  </span>
                </p>

                <div className="space-y-3 mb-6">
                  {categories.map((cat, i) => (
                    <div
                      key={i}
                      className="group relative flex items-center gap-4 rounded-xl border p-4 transition-colors duration-150"
                      style={{
                        background: "var(--v2-surface-raised)",
                        borderColor: "var(--v2-border)",
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--v2-surface-overlay)" }}
                      >
                        <DynamicIcon
                          name={cat.icon}
                          className="h-5 w-5"
                          style={{ color: "var(--v2-amber-400)" }}
                        />
                      </div>

                      {/* Name & Type */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <Input
                          value={cat.name}
                          onChange={(e) =>
                            updateCategory(i, "name", e.target.value)
                          }
                          className="h-8 border-none bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                          style={{
                            color: "var(--v2-text-primary)",
                            fontFamily: "var(--font-body)",
                          }}
                        />
                        <button
                          onClick={() => updateCategory(i, "isSideCategory", !cat.isSideCategory)}
                          className="self-start text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 mt-0.5 rounded-sm transition-colors duration-150"
                          style={{
                            color: cat.isSideCategory ? "var(--v2-sage-400)" : "var(--v2-text-muted)",
                            background: cat.isSideCategory ? "oklch(0.62 0.14 155 / 10%)" : "transparent",
                            border: `1px solid ${cat.isSideCategory ? "oklch(0.62 0.14 155 / 25%)" : "transparent"}`,
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {cat.isSideCategory ? "Side Quest" : "Main Goal"}
                        </button>
                      </div>

                      {/* Targets */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-center">
                          <label
                            className="block text-[8px] font-bold uppercase tracking-[0.15em] mb-0.5"
                            style={{
                              color: "var(--v2-text-muted)",
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            Daily (hrs)
                          </label>
                          <Input
                            type="number"
                            value={cat.dailyTargetHours}
                            onChange={(e) =>
                              updateCategory(
                                i,
                                "dailyTargetHours",
                                Math.max(0, Number(e.target.value))
                              )
                            }
                            className="h-7 w-14 rounded-lg border text-center text-xs font-bold shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                            style={{
                              background: "var(--v2-surface-overlay)",
                              borderColor: "var(--v2-border)",
                              color: "var(--v2-amber-300)",
                              fontFamily: "var(--font-display)",
                            }}
                            min={0}
                            step={0.5}
                          />
                        </div>
                        <div className="text-center">
                          <label
                            className="block text-[8px] font-bold uppercase tracking-[0.15em] mb-0.5"
                            style={{
                              color: "var(--v2-text-muted)",
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            Week (hrs)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={cat.weeklyMinTarget}
                              onChange={(e) =>
                                updateCategory(
                                  i,
                                  "weeklyMinTarget",
                                  Math.max(0, Number(e.target.value))
                                )
                              }
                              className="h-7 w-14 rounded-lg border text-center text-xs font-bold shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                              style={{
                                background: "var(--v2-surface-overlay)",
                                borderColor: "var(--v2-border)",
                                color: "var(--v2-text-secondary)",
                                fontFamily: "var(--font-display)",
                              }}
                              min={0}
                            />
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--v2-text-muted)" }}
                            >
                              –
                            </span>
                            <Input
                              type="number"
                              value={cat.weeklyMaxTarget}
                              onChange={(e) =>
                                updateCategory(
                                  i,
                                  "weeklyMaxTarget",
                                  Math.max(0, Number(e.target.value))
                                )
                              }
                              className="h-7 w-14 rounded-lg border text-center text-xs font-bold shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                              style={{
                                background: "var(--v2-surface-overlay)",
                                borderColor: "var(--v2-border)",
                                color: "var(--v2-text-secondary)",
                                fontFamily: "var(--font-display)",
                              }}
                              min={0}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeCategory(i)}
                        className="flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        style={{
                          color: "var(--v2-rose-400)",
                          background: "oklch(0.60 0.20 18 / 10%)",
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add category */}
                {categories.length < 7 && (
                  <button
                    onClick={addCategory}
                    className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs font-semibold transition-colors duration-150"
                    style={{
                      borderColor: "var(--v2-border-strong)",
                      color: "var(--v2-text-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Category
                  </button>
                )}

                {error && (
                  <p
                    className="mb-4 text-sm"
                    style={{ color: "var(--v2-rose-400)" }}
                  >
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="h-12 flex-1 rounded-xl font-bold text-sm border transition-all"
                    style={{
                      borderColor: "var(--v2-border-strong)",
                      background: "var(--v2-surface-raised)",
                      color: "var(--v2-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={
                      saving ||
                      categories.length === 0 ||
                      categories.some((c) => !c.name.trim())
                    }
                    className="h-12 flex-[2] rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40 v2-glow-btn"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
                      color: "var(--v2-obsidian-900)",
                      fontFamily: "var(--font-body)",
                      border: "none",
                    }}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    {saving ? "Saving..." : "Confirm & Start"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <div className="v2-accent-line fixed bottom-0 left-0 w-full" />
    </div>
  );
}
