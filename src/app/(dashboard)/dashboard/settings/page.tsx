"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon, { ALLOWED_ICONS } from "@/components/DynamicIcon";
import type { UserCategory } from "@/lib/logs";

export default function SettingsPage() {
  const { categories, refreshCategories } = useCategoriesContext();
  const [localCategories, setLocalCategories] = useState<UserCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [addText, setAddText] = useState("");
  const [addingAI, setAddingAI] = useState(false);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const handleSave = async () => {
    if (localCategories.some((c) => !c.name.trim())) {
      setError("All categories need a name.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: localCategories }),
      });
      if (!res.ok) throw new Error(await res.text());
      refreshCategories();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateCat = (
    index: number,
    field: keyof UserCategory,
    value: string | number | boolean
  ) => {
    setLocalCategories((prev) =>
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

  const removeCat = (index: number) => {
    setLocalCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const addManual = () => {
    if (localCategories.length >= 7) return;
    setLocalCategories((prev) => [
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

  const addWithAI = async () => {
    if (!addText.trim() || localCategories.length >= 7) return;
    setAddingAI(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: addText.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const remaining = 7 - localCategories.length;
      const newCats = (data.categories || []).slice(0, remaining);
      setLocalCategories((prev) => [...prev, ...newCats]);
      setAddText("");
    } catch (e: any) {
      setError(e?.message || "AI suggestion failed");
    } finally {
      setAddingAI(false);
    }
  };

  const cycleIcon = (index: number) => {
    const currentIcon = localCategories[index].icon;
    const currentIdx = ALLOWED_ICONS.indexOf(
      currentIcon as (typeof ALLOWED_ICONS)[number]
    );
    const nextIdx = (currentIdx + 1) % ALLOWED_ICONS.length;
    updateCat(index, "icon", ALLOWED_ICONS[nextIdx]);
  };

  const hasChanges =
    JSON.stringify(localCategories) !== JSON.stringify(categories);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Settings
        </h2>
        <span
          className="text-xs font-semibold"
          style={{
            color: "var(--v2-text-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {localCategories.length} / 7 categories
        </span>
      </div>

      <Card
        className="relative overflow-hidden p-0 border"
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

        <div className="p-6 md:p-8">
          <h3
            className="text-lg font-bold tracking-tight mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Categories
          </h3>
          <p
            className="text-sm mb-6"
            style={{
              color: "var(--v2-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Manage your productivity categories. Click an icon to cycle through options.
          </p>

          <div className="space-y-3 mb-6">
            {localCategories.map((cat, i) => (
              <div
                key={i}
                className="group relative flex items-center gap-3 rounded-xl border p-4 transition-colors"
                style={{
                  background: "var(--v2-surface-raised)",
                  borderColor: "var(--v2-border)",
                }}
              >
                {/* Clickable icon */}
                <button
                  onClick={() => cycleIcon(i)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={{ background: "var(--v2-surface-overlay)" }}
                  title="Click to change icon"
                >
                  <DynamicIcon
                    name={cat.icon}
                    className="h-5 w-5"
                    style={{ color: "var(--v2-amber-400)" }}
                  />
                </button>

                {/* Name & Type */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <Input
                    value={cat.name}
                    onChange={(e) => updateCat(i, "name", e.target.value)}
                    className="h-8 border-none bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                    style={{
                      color: "var(--v2-text-primary)",
                      fontFamily: "var(--font-body)",
                    }}
                    placeholder="Category name"
                  />
                  <button
                    onClick={() => updateCat(i, "isSideCategory", !cat.isSideCategory)}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-center">
                    <label
                      className="block text-[8px] font-bold uppercase tracking-[0.1em] mb-0.5"
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
                        updateCat(
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
                      className="block text-[8px] font-bold uppercase tracking-[0.1em] mb-0.5"
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
                          updateCat(
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
                          updateCat(
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

                {/* Delete */}
                <button
                  onClick={() => removeCat(i)}
                  className="flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    color: "var(--v2-rose-400)",
                    background: "oklch(0.60 0.20 18 / 10%)",
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add options */}
          {localCategories.length < 7 && (
            <div className="space-y-3 mb-6">
              <div className="flex gap-2">
                <Input
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="Describe new categories to add..."
                  onKeyDown={(e) => e.key === "Enter" && addWithAI()}
                  className="flex-1 h-10 rounded-lg border text-sm"
                  style={{
                    background: "var(--v2-surface-raised)",
                    borderColor: "var(--v2-border)",
                    color: "var(--v2-text-primary)",
                    fontFamily: "var(--font-body)",
                  }}
                />
                <Button
                  onClick={addWithAI}
                  disabled={!addText.trim() || addingAI}
                  className="h-10 rounded-lg px-4 text-xs font-bold gap-1"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
                    color: "var(--v2-obsidian-900)",
                    border: "none",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {addingAI ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  AI Add
                </Button>
              </div>

              <button
                onClick={addManual}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-xs font-semibold transition-colors"
                style={{
                  borderColor: "var(--v2-border-strong)",
                  color: "var(--v2-text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Manually
              </button>
            </div>
          )}

          {error && (
            <p
              className="mb-4 text-sm"
              style={{ color: "var(--v2-rose-400)" }}
            >
              {error}
            </p>
          )}

          {success && (
            <p
              className="mb-4 text-sm"
              style={{ color: "var(--v2-sage-400)" }}
            >
              Categories saved successfully!
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full h-12 rounded-xl text-sm font-bold transition-all disabled:opacity-40 v2-glow-btn"
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
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
