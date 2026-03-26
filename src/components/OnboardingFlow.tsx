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
  Shield,
  Leaf,
  BarChart3,
  Zap,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { UserCategory } from "@/lib/logs";
import { AI_PERSONA_OPTIONS, type AIPersona } from "@/lib/ai-profile";

interface OnboardingFlowProps {
  userName?: string;
}

type OnboardingStep = 1 | 2 | 3 | 4;

interface DraftAIProfile {
  persona: AIPersona | "";
  coreWhy: string;
  customInstructions: string;
}

const PERSONA_ICONS: Record<AIPersona, LucideIcon> = {
  drill_sergeant: Shield,
  mentor: Leaf,
  analyst: BarChart3,
  hype_man: Zap,
};

const WORLD_TIERS = [
  { name: "Basecamp",         emoji: "🏕️", sub: "Foundation",       gate: null,      accent: "oklch(0.60 0.06 260)", active: true },
  { name: "Ember Camp",       emoji: "🔥", sub: "Warmth",           gate: "1 day",   accent: "oklch(0.68 0.14 50)",  active: false },
  { name: "Iron Forge",       emoji: "⚒️", sub: "Pressure",         gate: "3 days",  accent: "oklch(0.80 0.20 50)",  active: false },
  { name: "Sky Citadel",      emoji: "☁️", sub: "Altitude",         gate: "7 days",  accent: "oklch(0.78 0.08 235)", active: false },
  { name: "Obsidian Sanctum", emoji: "👑", sub: "Mastery",          gate: "14 days", accent: "oklch(0.82 0.10 75)",  active: false },
];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function OnboardingFlow({ userName }: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(1);
  const {
    isListening,
    transcript: description,
    setTranscript: setDescription,
    startListening,
    stopListening,
    supported,
  } = useSpeechRecognition();
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [aiProfile, setAIProfile] = useState<DraftAIProfile>({
    persona: "",
    coreWhy: "",
    customInstructions: "",
  });
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
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (
      categories.length === 0 ||
      categories.some((category) => !category.name.trim()) ||
      !aiProfile.persona
    ) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          aiProfile: {
            persona: aiProfile.persona,
            coreWhy: aiProfile.coreWhy,
            customInstructions: aiProfile.customInstructions,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setStep(4);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (
    index: number,
    field: keyof UserCategory,
    value: string | number | boolean
  ) => {
    setCategories((prev) =>
      prev.map((cat, i) => {
        if (i !== index) return cat;

        const updatedCat = { ...cat, [field]: value };

        if (field === "dailyTargetHours") {
          const daily = Number(value) || 0;
          updatedCat.weeklyMinTarget = daily * 5;
          updatedCat.weeklyMaxTarget = daily * 7;
        }

        return updatedCat;
      })
    );
  };

  const updateAIProfile = (
    field: keyof DraftAIProfile,
    value: DraftAIProfile[keyof DraftAIProfile]
  ) => {
    setAIProfile((prev) => ({ ...prev, [field]: value }));
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

  const canContinueFromReview =
    categories.length > 0 && categories.every((category) => category.name.trim());

  /* Boosted accent for onboarding — brighter than Basecamp's muted default */
  const OB_ACCENT = "oklch(0.75 0.12 260)";
  const OB_ACCENT_DIM = "oklch(0.75 0.12 260 / 15%)";
  const OB_ACCENT_GLOW = "oklch(0.75 0.12 260 / 25%)";

  return (
    <div className="v2 momentum-root flex min-h-screen flex-col items-center justify-center px-6 py-12" data-streak-power="0" style={{ background: 'oklch(0.09 0.005 260)' }}>
      <div className="fixed top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${OB_ACCENT}, transparent)`, opacity: 0.5 }} />

      <div className="w-full max-w-2xl">
        <div className="v2-stagger-in v2-stagger-1 mb-10 text-center">
          <h1
            className="text-4xl font-extrabold tracking-tighter md:text-5xl"
            style={{ fontFamily: "var(--font-display)", color: "oklch(0.98 0 0)" }}
          >
            Discip<span style={{ color: OB_ACCENT }}>Log</span>
          </h1>
        </div>

        {step === 1 && (
          <div className="v2-stagger-in v2-stagger-2">
            <Card
              className="relative overflow-hidden border p-0"
              style={{
                background: "var(--world-surface)",
                borderColor: "var(--world-border)",
              }}
            >
              <div
                className="h-[2px] w-full"
                style={{
                  background: `linear-gradient(90deg, ${OB_ACCENT}, oklch(0.85 0.08 260), ${OB_ACCENT})`,
                  opacity: 0.4,
                }}
              />

              <div className="p-8 md:p-10">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: OB_ACCENT }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{
                      color: OB_ACCENT,
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
                    color: "var(--world-text-muted)",
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
                      background: "var(--world-surface-raised)",
                      borderColor: isListening
                        ? OB_ACCENT
                        : "var(--world-border)",
                      color: "var(--world-text-primary)",
                      fontFamily: "var(--font-body)",
                      boxShadow: isListening
                        ? `0 0 30px ${OB_ACCENT_DIM}`
                        : "none",
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
                          color: OB_ACCENT,
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
                          ? OB_ACCENT_DIM
                          : "var(--world-tab-active-bg)",
                        color: isListening
                          ? OB_ACCENT
                          : "var(--world-text-muted)",
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
                    style={{ color: "var(--world-text-secondary)" }}
                  >
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={!description.trim() || loading}
                  className="h-12 w-full rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40 hover:scale-[1.02]"
                  style={{
                    background: "oklch(0.96 0 0)",
                    color: "oklch(0.10 0 0)",
                    fontFamily: "var(--font-body)",
                    border: "none",
                    boxShadow: `0 0 30px ${OB_ACCENT_DIM}, 0 2px 8px oklch(0 0 0 / 30%)`,
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
                background: "var(--world-surface)",
                borderColor: "var(--world-border)",
              }}
            >
              <div
                className="h-[2px] w-full"
                style={{
                  background: `linear-gradient(90deg, ${OB_ACCENT}, oklch(0.85 0.08 260), ${OB_ACCENT})`,
                  opacity: 0.4,
                }}
              />

              <div className="p-8 md:p-10">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: OB_ACCENT }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{
                      color: OB_ACCENT,
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
                    color: "var(--world-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Tap any value to edit.{" "}
                  <span style={{ color: "var(--world-text-secondary)" }}>
                    {categories.length}/7 categories
                  </span>
                </p>

                <div className="mb-6 space-y-3">
                  {categories.map((cat, i) => (
                    <div
                      key={i}
                      className="group relative flex items-center gap-4 rounded-xl border p-4 transition-colors duration-150"
                      style={{
                        background: "var(--world-surface-raised)",
                        borderColor: "var(--world-border)",
                      }}
                    >
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--world-tab-active-bg)" }}
                      >
                        <DynamicIcon
                          name={cat.icon}
                          className="h-5 w-5"
                          style={{ color: OB_ACCENT }}
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <Input
                          value={cat.name}
                          onChange={(e) =>
                            updateCategory(i, "name", e.target.value)
                          }
                          className="h-8 border-none bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                          style={{
                            color: "var(--world-text-primary)",
                            fontFamily: "var(--font-body)",
                          }}
                        />
                        <button
                          onClick={() =>
                            updateCategory(
                              i,
                              "isSideCategory",
                              !cat.isSideCategory
                            )
                          }
                          className="mt-0.5 self-start rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors duration-150"
                          style={{
                            color: cat.isSideCategory
                              ? "var(--v2-sage-400)"
                              : "var(--world-text-muted)",
                            background: cat.isSideCategory
                              ? "oklch(0.62 0.14 155 / 10%)"
                              : "transparent",
                            border: `1px solid ${
                              cat.isSideCategory
                                ? "oklch(0.62 0.14 155 / 25%)"
                                : "transparent"
                            }`,
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {cat.isSideCategory ? "Side Quest" : "Main Goal"}
                        </button>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-3">
                        <div className="text-center">
                          <label
                            className="mb-0.5 block text-[8px] font-bold uppercase tracking-[0.15em]"
                            style={{
                              color: "var(--world-text-muted)",
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
                              background: "var(--world-tab-active-bg)",
                              borderColor: "var(--world-border)",
                              color: OB_ACCENT,
                              fontFamily: "var(--font-display)",
                            }}
                            min={0}
                            step={0.5}
                          />
                        </div>
                        <div className="text-center">
                          <label
                            className="mb-0.5 block text-[8px] font-bold uppercase tracking-[0.15em]"
                            style={{
                              color: "var(--world-text-muted)",
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
                                background: "var(--world-tab-active-bg)",
                                borderColor: "var(--world-border)",
                                color: "var(--world-text-secondary)",
                                fontFamily: "var(--font-display)",
                              }}
                              min={0}
                            />
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--world-text-muted)" }}
                            >
                              -
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
                                background: "var(--world-tab-active-bg)",
                                borderColor: "var(--world-border)",
                                color: "var(--world-text-secondary)",
                                fontFamily: "var(--font-display)",
                              }}
                              min={0}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeCategory(i)}
                        className="flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        style={{
                          color: "var(--world-text-secondary)",
                          background: "oklch(0.60 0.20 18 / 10%)",
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {categories.length < 7 && (
                  <button
                    onClick={addCategory}
                    className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs font-semibold transition-colors duration-150"
                    style={{
                      borderColor: "var(--world-border)",
                      color: "var(--world-text-muted)",
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
                    style={{ color: "var(--world-text-secondary)" }}
                  >
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="h-12 flex-1 rounded-xl border font-bold text-sm transition-all"
                    style={{
                      borderColor: "var(--world-border)",
                      background: "var(--world-surface-raised)",
                      color: "var(--world-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!canContinueFromReview}
                    className="h-12 flex-[2] rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40 hover:scale-[1.02]"
                    style={{
                      background: "oklch(0.96 0 0)",
                      color: "oklch(0.10 0 0)",
                      fontFamily: "var(--font-body)",
                      border: "none",
                      boxShadow: `0 0 30px ${OB_ACCENT_DIM}, 0 2px 8px oklch(0 0 0 / 30%)`,
                    }}
                  >
                    Continue to AI Coach
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="v2-stagger-in v2-stagger-2">
            <Card
              className="relative overflow-hidden border p-0"
              style={{
                background: "var(--world-surface)",
                borderColor: "var(--world-border)",
              }}
            >
              <div
                className="h-[2px] w-full"
                style={{
                  background: `linear-gradient(90deg, ${OB_ACCENT}, oklch(0.85 0.08 260), ${OB_ACCENT})`,
                  opacity: 0.4,
                }}
              />

              <div className="p-8 md:p-10">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: OB_ACCENT }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{
                      color: OB_ACCENT,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    AI Coach
                  </span>
                </div>

                <h2
                  className="mb-2 text-2xl font-bold tracking-tight md:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Choose how your coach pushes you
                </h2>
                <p
                  className="mb-6 text-sm leading-relaxed"
                  style={{
                    color: "var(--world-text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {userName ? `${userName}, ` : ""}
                  pick the tone you want, then add the motivation or reminders
                  you want the coach to remember.
                </p>

                <div className="mb-6 grid gap-3 md:grid-cols-2">
                  {AI_PERSONA_OPTIONS.map((option) => {
                    const Icon = PERSONA_ICONS[option.value];
                    const selected = aiProfile.persona === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateAIProfile("persona", option.value)}
                        className="rounded-2xl border p-4 text-left transition-all duration-200"
                        style={{
                          background: selected
                            ? OB_ACCENT_DIM
                            : "var(--world-surface-raised)",
                          borderColor: selected
                            ? OB_ACCENT_GLOW
                            : "var(--world-border)",
                          boxShadow: selected
                            ? `0 0 0 1px ${OB_ACCENT_DIM}`
                            : "none",
                        }}
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{
                              background: selected
                                ? OB_ACCENT_DIM
                                : "var(--world-tab-active-bg)",
                            }}
                          >
                            <Icon
                              className="h-5 w-5"
                              style={{ color: OB_ACCENT }}
                            />
                          </div>
                          <div>
                            <div
                              className="text-sm font-bold"
                              style={{
                                color: "var(--world-text-primary)",
                                fontFamily: "var(--font-display)",
                              }}
                            >
                              {option.label}
                            </div>
                            <div
                              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                              style={{
                                color: selected
                                  ? OB_ACCENT
                                  : "var(--world-text-muted)",
                                fontFamily: "var(--font-body)",
                              }}
                            >
                              {selected ? "Selected" : "Tap to choose"}
                            </div>
                          </div>
                        </div>
                        <p
                          className="text-sm leading-relaxed"
                          style={{
                            color: "var(--world-text-muted)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {option.shortDescription}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mb-4 space-y-2">
                  <label
                    className="block text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      color: "var(--world-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Core Why
                  </label>
                  <Textarea
                    value={aiProfile.coreWhy}
                    onChange={(e) => updateAIProfile("coreWhy", e.target.value)}
                    placeholder="What bigger goal is this discipline serving?"
                    className="min-h-[96px] rounded-xl border text-sm leading-relaxed"
                    style={{
                      background: "var(--world-surface-raised)",
                      borderColor: "var(--world-border)",
                      color: "var(--world-text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                </div>

                <div className="mb-6 space-y-2">
                  <label
                    className="block text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      color: "var(--world-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Custom Instructions
                  </label>
                  <Textarea
                    value={aiProfile.customInstructions}
                    onChange={(e) =>
                      updateAIProfile("customInstructions", e.target.value)
                    }
                    placeholder='Optional: "Remind me I am building this for my family."'
                    className="min-h-[110px] rounded-xl border text-sm leading-relaxed"
                    style={{
                      background: "var(--world-surface-raised)",
                      borderColor: "var(--world-border)",
                      color: "var(--world-text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                  />
                  <div
                    className="mt-2 flex items-start gap-2 rounded-lg px-3 py-2"
                    style={{
                      background: `oklch(0.75 0.12 260 / 6%)`,
                      border: `1px solid oklch(0.75 0.12 260 / 12%)`,
                    }}
                  >
                    <Lightbulb
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                      style={{ color: OB_ACCENT }}
                    />
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{
                        color: "var(--world-text-muted)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Your coach learns your habits automatically over time. Use
                      Custom Instructions only for rules you want from Day 1.
                    </p>
                  </div>
                </div>

                {error && (
                  <p
                    className="mb-4 text-sm"
                    style={{ color: "var(--world-text-secondary)" }}
                  >
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="h-12 flex-1 rounded-xl border font-bold text-sm transition-all"
                    style={{
                      borderColor: "var(--world-border)",
                      background: "var(--world-surface-raised)",
                      color: "var(--world-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !canContinueFromReview || !aiProfile.persona}
                    className="h-12 flex-[2] rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40 hover:scale-[1.02]"
                    style={{
                      background: "oklch(0.96 0 0)",
                      color: "oklch(0.10 0 0)",
                      fontFamily: "var(--font-body)",
                      border: "none",
                      boxShadow: `0 0 30px ${OB_ACCENT_DIM}, 0 2px 8px oklch(0 0 0 / 30%)`,
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

        {step === 4 && (
          <div className="v2-stagger-in v2-stagger-2">
            <Card
              className="relative overflow-hidden border p-0"
              style={{
                background: "var(--world-surface)",
                borderColor: "var(--world-border)",
              }}
            >
              {/* Rainbow accent line across all tier colors */}
              <div
                className="h-[2px] w-full"
                style={{
                  background:
                    "linear-gradient(90deg, oklch(0.60 0.06 260), oklch(0.68 0.14 50), oklch(0.80 0.20 50), oklch(0.78 0.08 235), oklch(0.82 0.10 75))",
                }}
              />

              <div className="p-8 md:p-10">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4"
                    style={{ color: OB_ACCENT }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{
                      color: OB_ACCENT,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Your Journey
                  </span>
                </div>

                <h2
                  className="mb-2 text-2xl font-bold tracking-tight md:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Every streak unlocks a new world
                </h2>
                <p
                  className="mb-8 text-sm leading-relaxed"
                  style={{
                    color: "oklch(0.60 0.005 260)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Your dashboard evolves as your consistency grows — new
                  colors, animations, and sounds. Each world is earned.
                </p>

                {/* ── Progress track ── */}
                <div className="relative mb-8 ml-1">
                  {WORLD_TIERS.map((tier, i) => {
                    const isLast = i === WORLD_TIERS.length - 1;

                    return (
                      <div key={tier.name}>
                        {/* ── Streak gate pill (between tiers) ── */}
                        {tier.gate && (
                          <div className="relative flex items-center py-1 pl-[15px]">
                            {/* Rail segment behind gate */}
                            <div
                              className="absolute left-[15px] top-0 bottom-0 w-[2px]"
                              style={{
                                background: tier.active
                                  ? tier.accent
                                  : "oklch(1 0 0 / 8%)",
                              }}
                            />
                            <div
                              className="relative z-10 ml-4 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
                              style={{
                                background: tier.active
                                  ? `color-mix(in oklch, ${tier.accent} 15%, transparent)`
                                  : "oklch(1 0 0 / 5%)",
                                border: `1px solid ${tier.active ? `color-mix(in oklch, ${tier.accent} 25%, transparent)` : "oklch(1 0 0 / 10%)"}`,
                                color: tier.active
                                  ? tier.accent
                                  : "oklch(0.55 0.01 260)",
                                fontFamily: "var(--font-body)",
                              }}
                            >
                              {tier.gate} streak
                            </div>
                          </div>
                        )}

                        {/* ── Tier node row ── */}
                        <div
                          className="relative flex items-center gap-4 py-2.5 pl-0"
                        >
                          {/* Rail segment below this node (except last) */}
                          {!isLast && (
                            <div
                              className="absolute left-[15px] top-[50%] bottom-0 w-[2px]"
                              style={{
                                background: WORLD_TIERS[i + 1]?.active
                                  ? WORLD_TIERS[i + 1].accent
                                  : "oklch(1 0 0 / 8%)",
                              }}
                            />
                          )}

                          {/* Node circle */}
                          <div
                            className="relative z-10 flex h-[32px] w-[32px] flex-shrink-0 items-center justify-center rounded-full text-base"
                            style={{
                              background: tier.active
                                ? `color-mix(in oklch, ${tier.accent} 20%, oklch(0.15 0.005 260))`
                                : "oklch(0.18 0.005 260)",
                              border: `2px solid ${tier.active ? tier.accent : "oklch(1 0 0 / 8%)"}`,
                              boxShadow: tier.active
                                ? `0 0 12px color-mix(in oklch, ${tier.accent} 30%, transparent), 0 0 4px color-mix(in oklch, ${tier.accent} 15%, transparent)`
                                : "none",
                            }}
                          >
                            <span style={{ fontSize: "14px" }}>{tier.emoji}</span>
                          </div>

                          {/* Tier info */}
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[13px] font-bold leading-tight"
                              style={{
                                color: tier.active
                                  ? "oklch(0.95 0 0)"
                                  : "oklch(0.62 0.01 260)",
                                fontFamily: "var(--font-display)",
                              }}
                            >
                              {tier.name}
                            </div>
                            <div
                              className="text-[10px] font-medium uppercase tracking-[0.14em] mt-0.5"
                              style={{
                                color: tier.active
                                  ? tier.accent
                                  : "oklch(0.50 0.01 260)",
                                fontFamily: "var(--font-body)",
                              }}
                            >
                              {tier.sub}
                            </div>
                          </div>

                          {/* Active indicator / lock */}
                          {tier.active ? (
                            <div
                              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                              style={{
                                background: `color-mix(in oklch, ${tier.accent} 12%, transparent)`,
                                border: `1px solid color-mix(in oklch, ${tier.accent} 20%, transparent)`,
                              }}
                            >
                              <div
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  background: tier.accent,
                                  boxShadow: `0 0 6px ${tier.accent}`,
                                }}
                              />
                              <span
                                className="text-[9px] font-bold uppercase tracking-[0.16em]"
                                style={{
                                  color: tier.accent,
                                  fontFamily: "var(--font-body)",
                                }}
                              >
                                You are here
                              </span>
                            </div>
                          ) : (
                            <div
                              className="text-[9px] font-bold uppercase tracking-[0.16em]"
                              style={{
                                color: "oklch(0.50 0.01 260)",
                                fontFamily: "var(--font-body)",
                              }}
                            >
                              Locked
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={() => {
                    router.push("/dashboard");
                    router.refresh();
                  }}
                  className="h-12 w-full rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: "oklch(0.96 0 0)",
                    color: "oklch(0.10 0 0)",
                    fontFamily: "var(--font-body)",
                    border: "none",
                    boxShadow: `0 0 30px ${OB_ACCENT_DIM}, 0 2px 8px oklch(0 0 0 / 30%)`,
                  }}
                >
                  Begin at Basecamp
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${OB_ACCENT}, transparent)`, opacity: 0.5 }} />
    </div>
  );
}
