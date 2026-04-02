"use client";

import { Badge } from "@/components/ui/badge";
import { Archive } from "lucide-react";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import DynamicIcon from "@/components/DynamicIcon";
import { useMomentum } from "@/components/MomentumProvider";
import { useWorld } from "@/components/worlds/WorldRenderer";

export default function WeeklyProgressV2() {
  const { categories: rawCategories, loading: catLoading } = useCategoriesContext();
  const categories = rawCategories || [];
  const {
    weeklyByCategory,
    streakPower,
    loading: momentumLoading,
    microInteractions,
  } = useMomentum();
  const { CardSkin, theme } = useWorld();
  const isLoading = catLoading || momentumLoading;

  const { progressShimmer } = microInteractions;

  const barGlowThreshold = streakPower >= 3 ? 30 : 60;

  // Compute orphaned hours from archived/removed categories
  const activeCatNames = new Set(categories.map((c) => c.name));
  const archivedHours = Object.entries(weeklyByCategory)
    .filter(([name]) => !activeCatNames.has(name))
    .reduce((sum, [, hours]) => sum + hours, 0);

  return (
    <CardSkin className="relative overflow-hidden" style={{ padding: 0 }}>
      {/* Accent line */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, opacity: 0.5 }} />

      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-lg font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: theme.textPrimary,
              transition: "color 800ms ease",
            }}
          >
            Weekly Progress
          </h3>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}
          >
            This week
          </span>
        </div>

        <div className="space-y-5">
          {categories.map((cat) => {
            const logged = weeklyByCategory[cat.name] || 0;
            const hasTarget = cat.weeklyMaxTarget > 0;
            const percentage = hasTarget
              ? Math.min((logged / cat.weeklyMaxTarget) * 100, 100)
              : logged > 0 ? 100 : 0;
            const isOnTrack = hasTarget ? logged >= cat.weeklyMinTarget : logged > 0;
            const isExceeding = hasTarget && logged >= cat.weeklyMaxTarget;

            return (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-1.5 rounded-lg"
                      style={{ background: theme.surfaceRaised }}
                    >
                      <DynamicIcon
                        name={cat.icon}
                        className="w-3.5 h-3.5 transition-colors duration-500"
                        style={{
                          color: isOnTrack ? theme.accent : theme.textMuted,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)", color: theme.textSecondary }}>
                      {cat.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold tabular-nums transition-colors duration-500"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: isOnTrack ? theme.accent : theme.textSecondary,
                      }}
                    >
                      {isLoading ? "—" : `${logged.toFixed(2)}h`}
                      {hasTarget && (
                        <span className="font-medium" style={{ color: theme.textMuted }}>
                          {" "}/ {cat.weeklyMinTarget}–{cat.weeklyMaxTarget}h
                        </span>
                      )}
                    </span>

                    {!isLoading && isOnTrack && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border"
                        style={{
                          borderColor: `${theme.accent}40`,
                          color: theme.accent,
                          background: `${theme.accent}0D`,
                          fontFamily: "var(--font-body)",
                          animation: isExceeding && streakPower >= 2
                            ? "badge-celebrate 2s ease-in-out infinite"
                            : "none",
                        }}
                      >
                        {isExceeding ? "Exceeding!" : !hasTarget ? "Active!" : "On Track"}
                      </Badge>
                    )}

                    {!isLoading && !isOnTrack && hasTarget && !cat.isSideCategory && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border"
                        style={{
                          borderColor: "oklch(0.60 0.20 18 / 20%)",
                          color: "oklch(0.65 0.18 18)",
                          background: "oklch(0.60 0.20 18 / 5%)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        Behind
                      </Badge>
                    )}

                    {!isLoading && !isOnTrack && hasTarget && cat.isSideCategory && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 border"
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
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className={`w-full h-2 rounded-full overflow-hidden ${
                    !isOnTrack && progressShimmer ? "progress-shimmer" : ""
                  }`}
                  style={{ background: `color-mix(in oklch, ${theme.accent} 10%, ${theme.surfaceRaised})` }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: isLoading ? "0%" : `${percentage}%`,
                      background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent})`,
                      transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1), background 800ms ease",
                      boxShadow: percentage > barGlowThreshold
                        ? `0 0 12px ${theme.accentGlow}`
                        : "none",
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Archived aggregate row */}
          {!isLoading && archivedHours > 0 && (
            <div style={{ opacity: 0.6 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="p-1.5 rounded-lg"
                    style={{ background: theme.surfaceRaised }}
                  >
                    <Archive
                      className="w-3.5 h-3.5"
                      style={{ color: theme.textMuted }}
                    />
                  </div>
                  <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)", color: theme.textMuted }}>
                    Archived
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{
                      fontFamily: "var(--font-display)",
                      color: theme.textMuted,
                    }}
                  >
                    {archivedHours.toFixed(2)}h
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border"
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
              </div>
            </div>
          )}
        </div>
      </div>
    </CardSkin>
  );
}
