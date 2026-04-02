"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Archive, StickyNote } from "lucide-react";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon from "@/components/DynamicIcon";
import { useMomentum } from "@/components/MomentumProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";
import CategoryNotesModal from "@/components/CategoryNotesModal";

export default function DailyProgressV2() {
  const { categories, loading: catLoading } = useCategoriesContext();
  const {
    todayByCategory,
    todayHours,
    dailyEnergy,
    streakPower,
    loading: momentumLoading,
    microInteractions,
  } = useMomentum();
  const { CardSkin, theme } = useWorld();
  const isLoading = catLoading || momentumLoading;
  const [notesCategoryId, setNotesCategoryId] = useState<string | null>(null);
  const notesCategory = useMemo(
    () =>
      categories.find((category) => String(category._id) === notesCategoryId) ??
      null,
    [categories, notesCategoryId]
  );

  const { completionPulse, progressShimmer } = microInteractions;

  const barGlow = dailyEnergy >= 4
    ? `0 0 12px ${theme.accentGlow}`
    : "none";

  // Compute orphaned hours from archived/removed categories
  const activeCatNames = new Set(categories.map((c) => c.name));
  const archivedHours = Object.entries(todayByCategory)
    .filter(([name]) => !activeCatNames.has(name))
    .reduce((sum, [, hours]) => sum + hours, 0);

  return (
    <>
      <CardSkin className="relative overflow-hidden" style={{ padding: 0 }}>
        {/* Accent line */}
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, opacity: 0.5 }} />

        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-5">
            <h3
              className="text-lg font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.textPrimary,
                transition: "color 800ms ease",
              }}
            >
              Today&apos;s Breakdown
            </h3>
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold tracking-tight transition-colors duration-500"
                style={{
                  fontFamily: "var(--font-display)",
                  color: todayHours > 0 ? theme.accent : theme.textMuted,
                }}
              >
                {isLoading ? "—" : `${todayHours.toFixed(2)}h`}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}
              >
                logged
              </span>
            </div>
          </div>

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(categories.length + (archivedHours > 0 ? 1 : 0), 4)}, minmax(0, 1fr))` }}
          >
            {categories.map((cat) => {
              const logged = todayByCategory[cat.name] || 0;
              const hasTarget = cat.dailyTargetHours > 0;
              const percentage = hasTarget
                ? Math.min((logged / cat.dailyTargetHours) * 100, 100)
                : logged > 0 ? 100 : 0;
              const isDone = hasTarget ? logged >= cat.dailyTargetHours : logged > 0;

              return (
                <div
                  key={cat.name}
                  className={`relative rounded-xl p-4 border transition-all duration-500 ${
                    isDone && completionPulse ? "completion-pulse" : ""
                  }`}
                  style={{
                    background: theme.surfaceRaised,
                    borderColor: theme.border,
                    borderRadius: theme.borderRadius,
                  }}
                >


                  {/* Icon + label */}
                  <div className="flex items-center gap-2 mb-3">
                    <DynamicIcon
                      name={cat.icon || "CircleDashed"}
                      className="w-4 h-4 transition-colors duration-500"
                      style={{
                        color: isDone ? theme.accent : theme.textMuted,
                      }}
                    />
                    <span
                      className="text-[11px] font-semibold truncate"
                      style={{ color: theme.textSecondary, fontFamily: "var(--font-body)" }}
                    >
                      {cat.name}
                    </span>
                  </div>

                  {/* Hours */}
                  <div className="flex items-baseline gap-1 mb-2.5">
                    <span
                      className="text-xl font-bold tabular-nums transition-colors duration-500"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: isDone ? theme.accent : theme.textPrimary,
                      }}
                    >
                      {isLoading ? "—" : logged.toFixed(2)}
                    </span>
                    {hasTarget && (
                      <span className="text-xs font-medium" style={{ color: theme.textMuted }}>
                        / {cat.dailyTargetHours}h
                      </span>
                    )}
                    {!hasTarget && logged > 0 && (
                      <span className="text-xs font-medium" style={{ color: theme.textMuted }}>
                        h ✓
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div
                    className={`w-full h-1.5 rounded-full overflow-hidden ${
                      !isDone && progressShimmer ? "progress-shimmer" : ""
                    }`}
                    style={{ background: `color-mix(in oklch, ${theme.accent} 10%, ${theme.surfaceRaised})` }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: isLoading ? "0%" : `${percentage}%`,
                        background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent})`,
                        transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1), background 800ms ease",
                        boxShadow: isDone ? barGlow : "none",
                      }}
                    />
                  </div>

                  {/* Badge */}
                  {!isLoading && isDone && (
                    <Badge
                      variant="outline"
                      className="mt-2 text-[9px] px-1.5 py-0 border"
                      style={{
                        borderColor: `${theme.accent}40`,
                        color: theme.accent,
                        background: `${theme.accent}0D`,
                        fontFamily: "var(--font-body)",
                        animation: streakPower >= 3 ? "badge-celebrate 2s ease-in-out infinite" : "none",
                      }}
                    >
                      Done!
                    </Badge>
                  )}
                  {!isLoading && !isDone && cat.isSideCategory && (
                    <Badge
                      variant="outline"
                      className="mt-2 text-[9px] px-1.5 py-0 border"
                      style={{
                        borderColor: "transparent",
                        color: theme.textMuted,
                        background: theme.surfaceRaised,
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      Optional
                    </Badge>
                  )}

                  {/* Next Steps button */}
                  <button
                    className="catnotes-card-btn relative"
                    onClick={() => setNotesCategoryId(String(cat._id))}
                    style={{
                      borderColor: `${theme.accent}20`,
                    }}
                  >
                    <StickyNote className="w-3 h-3" style={{ color: theme.accent }} />
                    <span>Notes</span>
                    {(cat.notes?.filter((n) => !n.done).length ?? 0) > 0 && (
                      <div
                        className="absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-black shadow-md z-10"
                        style={{
                          background: 'var(--v2-amber-400)',
                          color: 'var(--v2-obsidian-900)',
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {cat.notes!.filter((n) => !n.done).length}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Archived aggregate card */}
            {!isLoading && archivedHours > 0 && (
              <div
                className="rounded-xl p-4 border transition-all duration-500"
                style={{
                  background: theme.surfaceRaised,
                  borderColor: theme.border,
                  borderRadius: theme.borderRadius,
                  opacity: 0.6,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Archive
                    className="w-4 h-4"
                    style={{ color: theme.textMuted }}
                  />
                  <span
                    className="text-[11px] font-semibold truncate"
                    style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}
                  >
                    Archived
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2.5">
                  <span
                    className="text-xl font-bold tabular-nums"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: theme.textSecondary,
                    }}
                  >
                    {archivedHours.toFixed(2)}
                  </span>
                  <span className="text-xs font-medium" style={{ color: theme.textMuted }}>
                    h
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="mt-2 text-[9px] px-1.5 py-0 border"
                  style={{
                    borderColor: "transparent",
                    color: theme.textMuted,
                    background: theme.surfaceRaised,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Carried
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardSkin>

      {/* Notes Modal */}
      {notesCategory && (
        <CategoryNotesModal
          category={notesCategory}
          theme={theme}
          onClose={() => setNotesCategoryId(null)}
        />
      )}
    </>
  );
}
