"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Sparkles,
  Shield,
  Leaf,
  BarChart3,
  Zap,
  Bell,
  BellOff,
  Archive,
  ArchiveRestore,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon, { ALLOWED_ICONS } from "@/components/DynamicIcon";
import type { UserCategory } from "@/lib/logs";
import {
  AI_PERSONA_OPTIONS,
  getDefaultExplicitAIProfile,
  type AIPersona,
  type AIProfileWithMemoryMeta,
  type ExplicitAIProfile,
} from "@/lib/ai-profile";

const PERSONA_ICONS: Record<AIPersona, LucideIcon> = {
  drill_sergeant: Shield,
  mentor: Leaf,
  analyst: BarChart3,
  hype_man: Zap,
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function SettingsPage() {
  const { categories, allCategories, refreshCategories } = useCategoriesContext();
  const [localCategories, setLocalCategories] = useState<UserCategory[]>([]);
  const [localArchived, setLocalArchived] = useState<UserCategory[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoriesSuccess, setCategoriesSuccess] = useState(false);
  const [addText, setAddText] = useState("");
  const [addingAI, setAddingAI] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "archive" | "delete";
    index: number;
  } | null>(null);

  const [profile, setProfile] = useState<ExplicitAIProfile>(
    getDefaultExplicitAIProfile()
  );
  const [savedProfile, setSavedProfile] = useState<ExplicitAIProfile>(
    getDefaultExplicitAIProfile()
  );
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [implicitMemory, setImplicitMemory] = useState("");
  const [implicitMemoryUpdatedAt, setImplicitMemoryUpdatedAt] = useState<
    string | null
  >(null);

  useEffect(() => {
    setLocalCategories(categories);
    setLocalArchived(allCategories.filter((c) => c.isArchived));
  }, [categories, allCategories]);

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError("");

      try {
        const res = await fetch("/api/users/profile");
        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = (await res.json()) as AIProfileWithMemoryMeta;
        setProfile(data);
        setSavedProfile(data);
        setImplicitMemory(data.implicitMemory || "");
        setImplicitMemoryUpdatedAt(
          data.implicitMemoryUpdatedAt
            ? String(data.implicitMemoryUpdatedAt)
            : null
        );
      } catch (error: unknown) {
        setProfileError(getErrorMessage(error, "Failed to load AI coach settings"));
      } finally {
        setProfileLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleCategorySave = async () => {
    if (localCategories.some((c) => !c.name.trim())) {
      setCategoriesError("All categories need a name.");
      return;
    }

    setCategoriesSaving(true);
    setCategoriesError("");
    setCategoriesSuccess(false);

    try {
      // Merge active + archived categories for the save
      const allCats = [
        ...localCategories.map((c) => ({ ...c, isArchived: false })),
        ...localArchived.map((c) => ({ ...c, isArchived: true })),
      ];
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: allCats }),
      });

      if (!res.ok) throw new Error(await res.text());

      refreshCategories();
      setCategoriesSuccess(true);
      setTimeout(() => setCategoriesSuccess(false), 3000);
    } catch (error: unknown) {
      setCategoriesError(getErrorMessage(error, "Failed to save"));
    } finally {
      setCategoriesSaving(false);
    }
  };

  const handleProfileSave = async () => {
    if (!profile.persona) {
      setProfileError("Please choose an AI coach persona.");
      return;
    }

    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess(false);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = (await res.json()) as ExplicitAIProfile;
      setProfile(data);
      setSavedProfile(data);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error: unknown) {
      setProfileError(
        getErrorMessage(error, "Failed to save AI coach settings")
      );
    } finally {
      setProfileSaving(false);
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
    setPendingAction(null);
  };

  const archiveCat = (index: number) => {
    const cat = localCategories[index];
    setLocalCategories((prev) => prev.filter((_, i) => i !== index));
    setLocalArchived((prev) => [...prev, { ...cat, isArchived: true }]);
    setPendingAction(null);
  };

  const unarchiveCat = (index: number) => {
    if (localCategories.length >= 8) {
      setCategoriesError("Unarchive failed: you already have 8 active categories.");
      return;
    }
    const cat = localArchived[index];
    setLocalArchived((prev) => prev.filter((_, i) => i !== index));
    setLocalCategories((prev) => [...prev, { ...cat, isArchived: false }]);
  };

  const addManual = () => {
    if (localCategories.length >= 8) return;
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
    if (!addText.trim() || localCategories.length >= 8) return;
    setAddingAI(true);
    setCategoriesError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: addText.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const remaining = 8 - localCategories.length;
      const newCats = (data.categories || []).slice(0, remaining);
      setLocalCategories((prev) => [...prev, ...newCats]);
      setAddText("");
    } catch (error: unknown) {
      setCategoriesError(getErrorMessage(error, "AI suggestion failed"));
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

  const updateProfile = (
    field: keyof ExplicitAIProfile,
    value: ExplicitAIProfile[keyof ExplicitAIProfile]
  ) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const archivedFromContext = allCategories.filter((c) => c.isArchived);
  const categoryHasChanges =
    JSON.stringify(localCategories) !== JSON.stringify(categories) ||
    JSON.stringify(localArchived) !== JSON.stringify(archivedFromContext);
  const profileHasChanges =
    JSON.stringify(profile) !== JSON.stringify(savedProfile);

  const activeOnly = localCategories.filter((c) => !c.isArchived);
  const totalDaily = activeOnly.reduce(
    (sum, cat) => sum + (Number(cat.dailyTargetHours) || 0),
    0
  );
  const totalWeeklyMin = activeOnly.reduce(
    (sum, cat) => sum + (Number(cat.weeklyMinTarget) || 0),
    0
  );
  const totalWeeklyMax = activeOnly.reduce(
    (sum, cat) => sum + (Number(cat.weeklyMaxTarget) || 0),
    0
  );

  return (
    <div className="settings-stack">
      {/* ─── Categories Section ─── */}
      <div className="settings-section v2-stagger-in v2-stagger-1">
        <div className="settings-section-header">
          <div>
            <h3 className="settings-section-title">Categories</h3>
            <p
              style={{
                color: "var(--v2-text-muted)",
                fontSize: "0.8125rem",
                marginTop: "0.25rem",
                fontWeight: 500,
              }}
            >
              Daily Total: {totalDaily}h <span style={{ opacity: 0.5, margin: "0 0.375rem" }}>&bull;</span> Weekly Total: {totalWeeklyMin}h &ndash; {totalWeeklyMax}h
            </p>
          </div>
          <span className="settings-count-badge">
            {localCategories.length} / 8
          </span>
        </div>

        <div className="settings-cat-list">
          {localCategories.map((cat, i) => (
            <div key={i} className="settings-cat-row group">
              {/* Icon button */}
              <button
                onClick={() => cycleIcon(i)}
                className="settings-cat-icon"
                title="Click to change icon"
              >
                <DynamicIcon name={cat.icon} className="w-4.5 h-4.5" />
              </button>

              {/* Name + side quest toggle */}
              <div className="settings-cat-info">
                <Input
                  value={cat.name}
                  onChange={(e) => updateCat(i, "name", e.target.value)}
                  className="settings-cat-name-input"
                  placeholder="Category name"
                />
                <button
                  onClick={() =>
                    updateCat(i, "isSideCategory", !cat.isSideCategory)
                  }
                  className={`settings-cat-badge ${cat.isSideCategory ? "side" : ""}`}
                >
                  {cat.isSideCategory ? "Side Quest" : "Main Goal"}
                </button>
              </div>

              {/* Targets */}
              <div className="settings-targets">
                <div className="settings-target-group">
                  <label className="settings-target-label">Daily</label>
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
                    className="settings-target-input amber"
                    min={0}
                    step={0.5}
                  />
                </div>
                <div className="settings-target-group">
                  <label className="settings-target-label">Week</label>
                  <div className="settings-target-range">
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
                      className="settings-target-input"
                      min={0}
                    />
                    <span className="settings-target-sep">–</span>
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
                      className="settings-target-input"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Archive + Delete */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPendingAction({ type: "archive", index: i })}
                  className="settings-cat-delete"
                  title="Archive category"
                  style={{ color: "var(--v2-text-muted)" }}
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPendingAction({ type: "delete", index: i })}
                  className="settings-cat-delete"
                  title="Delete category permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add category */}
        {localCategories.length < 8 && (
          <div className="settings-add-area">
            <div className="settings-add-row">
              <Input
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                placeholder="Describe new categories…"
                onKeyDown={(e) => e.key === "Enter" && addWithAI()}
                className="settings-add-input"
              />
              <Button
                onClick={addWithAI}
                disabled={!addText.trim() || addingAI}
                className="settings-ai-btn v2-glow-btn"
              >
                {addingAI ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                AI
              </Button>
            </div>

            <button onClick={addManual} className="settings-add-manual">
              <Plus className="w-3.5 h-3.5" />
              Add Manually
            </button>
          </div>
        )}

        {/* Feedback */}
        {categoriesError && (
          <p className="settings-error">{categoriesError}</p>
        )}
        {categoriesSuccess && (
          <p className="settings-success">Categories saved!</p>
        )}

        {/* Save */}
        <Button
          onClick={handleCategorySave}
          disabled={categoriesSaving || !categoryHasChanges}
          className="settings-save-btn v2-glow-btn"
        >
          {categoriesSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {categoriesSaving
            ? "Saving…"
            : categoryHasChanges
              ? "Save Categories"
              : "No Changes"}
        </Button>

        {/* Archived Categories Panel */}
        {localArchived.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="settings-add-manual"
              style={{
                width: "100%",
                justifyContent: "space-between",
                padding: "0.625rem 0.75rem",
                marginBottom: showArchived ? "0.75rem" : 0,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Archive className="w-3.5 h-3.5" />
                Archived ({localArchived.length})
              </span>
              <ChevronDown
                className="w-3.5 h-3.5"
                style={{
                  transition: "transform 200ms ease",
                  transform: showArchived ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {showArchived && (
              <div className="settings-cat-list" style={{ opacity: 0.75 }}>
                {localArchived.map((cat, i) => (
                  <div
                    key={`archived-${i}`}
                    className="settings-cat-row group"
                    style={{ opacity: 0.8 }}
                  >
                    <div className="settings-cat-icon">
                      <DynamicIcon name={cat.icon} className="w-4.5 h-4.5" />
                    </div>
                    <div className="settings-cat-info" style={{ flex: 1 }}>
                      <span
                        style={{
                          color: "var(--v2-text-muted)",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {cat.name}
                      </span>
                    </div>
                    <button
                      onClick={() => unarchiveCat(i)}
                      className="settings-cat-delete"
                      title="Restore category"
                      style={{ color: "var(--v2-sage-400)" }}
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal */}
        {pendingAction && localCategories[pendingAction.index] && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "oklch(0 0 0 / 60%)",
              backdropFilter: "blur(6px)",
            }}
            onClick={() => setPendingAction(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--v2-surface-card, oklch(0.16 0.01 260))",
                border: "1px solid var(--v2-border, oklch(1 0 0 / 8%))",
                borderRadius: "16px",
                padding: "1.5rem",
                maxWidth: "380px",
                width: "90vw",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                {pendingAction.type === "archive" ? (
                  <Archive className="w-4.5 h-4.5" style={{ color: "var(--v2-text-muted)" }} />
                ) : (
                  <Trash2 className="w-4.5 h-4.5" style={{ color: "oklch(0.65 0.18 18)" }} />
                )}
                <h4
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: "var(--v2-text-primary)",
                    margin: 0,
                  }}
                >
                  {pendingAction.type === "archive" ? "Archive Category?" : "Delete Category?"}
                </h4>
                {pendingAction.type === "delete" && (
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "oklch(0.65 0.18 18)",
                      background: "oklch(0.60 0.20 18 / 12%)",
                      border: "1px solid oklch(0.60 0.20 18 / 25%)",
                      borderRadius: "6px",
                      padding: "0.125rem 0.5rem",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Dangerous
                  </span>
                )}
              </div>

              {/* Body */}
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8125rem",
                  color: "var(--v2-text-secondary)",
                  lineHeight: 1.6,
                  margin: "0 0 1.25rem 0",
                }}
              >
                {pendingAction.type === "archive" ? (
                  <>
                    <strong style={{ color: "var(--v2-text-primary)" }}>
                      {localCategories[pendingAction.index]?.name || "this category"}
                    </strong>{" "}
                    will be hidden from your dashboard and logger. Any hours already logged will appear as &ldquo;Archived&rdquo; on your overview. You can restore it anytime.
                  </>
                ) : (
                  <>
                    <strong style={{ color: "var(--v2-text-primary)" }}>
                      {localCategories[pendingAction.index]?.name || "this category"}
                    </strong>{" "}
                    will be permanently removed. Your existing logs won&rsquo;t be deleted, but the category definition will be gone forever. This cannot be undone.
                  </>
                )}
              </p>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setPendingAction(null)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.375rem",
                    height: "2.25rem",
                    padding: "0 1rem",
                    borderRadius: "10px",
                    border: "1px solid var(--v2-border, oklch(1 0 0 / 10%))",
                    background: "var(--v2-surface-raised, oklch(0.18 0.01 260))",
                    color: "var(--v2-text-secondary, oklch(0.7 0.02 260))",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (pendingAction.type === "archive") {
                      archiveCat(pendingAction.index);
                    } else {
                      removeCat(pendingAction.index);
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.375rem",
                    height: "2.25rem",
                    padding: "0 1rem",
                    borderRadius: "10px",
                    border: pendingAction.type === "delete"
                      ? "1px solid oklch(0.60 0.20 18 / 40%)"
                      : "1px solid var(--v2-border, oklch(1 0 0 / 10%))",
                    background: pendingAction.type === "delete"
                      ? "linear-gradient(135deg, oklch(0.50 0.20 18), oklch(0.40 0.18 18))"
                      : "var(--v2-surface-raised, oklch(0.18 0.01 260))",
                    color: pendingAction.type === "delete"
                      ? "#fff"
                      : "var(--v2-text-primary, oklch(0.9 0.01 260))",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  {pendingAction.type === "archive" ? (
                    <><Archive className="w-3.5 h-3.5" /> Archive</>
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" /> Delete Forever</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── AI Coach Section ─── */}
      <div className="settings-section v2-stagger-in v2-stagger-2">
        <div className="settings-section-header">
          <h3 className="settings-section-title">AI Coach</h3>
        </div>

        {profileLoading ? (
          <div className="settings-loading">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : (
          <>
            {/* Persona grid */}
            <div className="settings-persona-grid">
              {AI_PERSONA_OPTIONS.map((option) => {
                const Icon = PERSONA_ICONS[option.value];
                const selected = profile.persona === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateProfile("persona", option.value)}
                    className={`settings-persona-card ${selected ? "active" : ""}`}
                  >
                    <div className="settings-persona-header">
                      <div className={`settings-persona-icon ${selected ? "active" : ""}`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="settings-persona-meta">
                        <span className="settings-persona-name">
                          {option.label}
                        </span>
                        <span className={`settings-persona-status ${selected ? "active" : ""}`}>
                          {selected ? "Active" : "Select"}
                        </span>
                      </div>
                    </div>
                    <p className="settings-persona-desc">
                      {option.shortDescription}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Core Why */}
            <div className="settings-field">
              <label className="settings-field-label">Core Why</label>
              <Textarea
                value={profile.coreWhy}
                onChange={(e) => updateProfile("coreWhy", e.target.value)}
                placeholder="What bigger goal is your discipline serving?"
                className="settings-textarea"
              />
            </div>

            {/* Custom Instructions */}
            <div className="settings-field">
              <label className="settings-field-label">Custom Instructions</label>
              <Textarea
                value={profile.customInstructions}
                onChange={(e) =>
                  updateProfile("customInstructions", e.target.value)
                }
                placeholder='"Keep reminding me that consistency matters more than intensity."'
                className="settings-textarea tall"
              />
            </div>

            {/* Feedback */}
            {profileError && (
              <p className="settings-error">{profileError}</p>
            )}
            {profileSuccess && (
              <p className="settings-success">AI coach settings saved!</p>
            )}

            {/* Save */}
            <Button
              onClick={handleProfileSave}
              disabled={profileSaving || !profileHasChanges}
              className="settings-save-btn v2-glow-btn"
            >
              {profileSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {profileSaving
                ? "Saving…"
                : profileHasChanges
                  ? "Save AI Coach"
                  : "No Changes"}
            </Button>

            {/* Implicit Memory */}
            <div className="settings-memory-box">
              <h4 className="settings-memory-title">What Your Coach Observes</h4>
              <p className={`settings-memory-text ${implicitMemory ? "" : "empty"}`}>
                {implicitMemory ||
                  "Your coach hasn\u2019t formed observations yet. Keep logging!"}
              </p>
              {implicitMemoryUpdatedAt && (
                <p className="settings-memory-date">
                  Last updated:{" "}
                  {new Date(implicitMemoryUpdatedAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Notifications Section ─── */}
      <NotificationsSection />
    </div>
  );
}

function NotificationsSection() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="settings-section v2-stagger-in v2-stagger-3">
      <div className="settings-section-header">
        <h3 className="settings-section-title">Notifications</h3>
        {isSubscribed && (
          <span
            className="settings-count-badge"
            style={{ color: "oklch(0.72 0.16 145)" }}
          >
            Active
          </span>
        )}
      </div>

      {!isSupported ? (
        <div className="settings-memory-box">
          <p className="settings-memory-text empty">
            Push notifications are not supported in this browser. Try Chrome,
            Edge, or Firefox on desktop/Android.
          </p>
        </div>
      ) : (
        <>
          <div className="settings-memory-box">
            <p
              className="settings-memory-text"
              style={{ marginBottom: "0.75rem" }}
            >
              {isSubscribed
                ? "Your AI coach will send you personalized nudges when you\u2019re falling behind schedule. Up to 3 smart notifications per day, timed to your habits."
                : "Enable notifications to let your AI coach keep you on track with personalized nudges timed to your work patterns."}
            </p>

            {permission === "denied" && (
              <p
                className="settings-error"
                style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}
              >
                Notifications are blocked by your browser. To re-enable, go to
                your browser\u2019s site settings and allow notifications for
                this site.
              </p>
            )}
          </div>

          <Button
            onClick={handleToggle}
            disabled={isLoading || permission === "denied"}
            className="settings-save-btn v2-glow-btn"
            style={
              isSubscribed
                ? {
                    background: "oklch(0.25 0.02 0)",
                    borderColor: "oklch(0.35 0.04 25)",
                    color: "oklch(0.7 0.12 25)",
                  }
                : undefined
            }
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSubscribed ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {isLoading
              ? "Updating\u2026"
              : isSubscribed
                ? "Disable Notifications"
                : "Enable Push Notifications"}
          </Button>
        </>
      )}
    </div>
  );
}
