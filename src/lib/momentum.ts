import type { DashboardLog, UserCategory } from "@/lib/logs";
import { formatLocalDate, getWeekStart } from "@/lib/logs";

/* ── Types ── */

export type DailyEnergy = 0 | 1 | 2 | 3 | 4 | 5;
export type StreakPower = 0 | 1 | 2 | 3 | 4;

export type DailyEnergyTier =
  | "cold"
  | "spark"
  | "warming"
  | "burning"
  | "blazing"
  | "peak";

export type StreakPowerTier =
  | "dormant"
  | "ember"
  | "campfire"
  | "inferno"
  | "legendary";

export type CardEntrance = "none" | "fade" | "slide-up" | "float-down" | "slow-fade";
export type CompletionSound = "none" | "forge-hammer" | "wind-chime" | "deep-resonance";
export type BadgeFloat = "none" | "subtle" | "gentle" | "calm" | "still";

export interface MicroInteractions {
  /* Hover — energy-driven */
  hoverLift: boolean;          // energy >= 1
  hoverGlow: boolean;          // energy >= 2
  hoverRipple: boolean;        // Forge day 4+

  /* Card entrance — streak-driven */
  cardEntrance: CardEntrance;

  /* Celebrations — energy-driven */
  completionPulse: boolean;    // energy >= 3
  progressShimmer: boolean;    // energy >= 4
  confetti: boolean;           // energy === 5

  /* Scroll — streak-driven */
  smoothScroll: boolean;       // Ember day 2+
  parallaxBg: boolean;         // Sky day 8+

  /* Sound — streak-driven */
  completionSound: CompletionSound;

  /* Badge float — tier-driven, evolves with the skin */
  badgeFloat: BadgeFloat;            // none → subtle → gentle → calm → still
}

export interface StreakUnlockProgress {
  isUnlocked: boolean;
  targetHours: number;
  currentHours: number;
  remainingHours: number;
  status: "secured" | "continuing" | "revivable";
  projectedStreak: number;
}

export interface MomentumState {
  /* Visual levels */
  dailyEnergy: DailyEnergy;
  dailyEnergyTier: DailyEnergyTier;
  streakPower: StreakPower;
  streakPowerTier: StreakPowerTier;

  /* Shared aggregates — single source of truth */
  todayHours: number;
  todayByCategory: Record<string, number>;
  todayTargetPercent: number;
  todayLogCount: number;
  weeklyHours: number;
  weeklyByCategory: Record<string, number>;
  streakDays: number;
  streakUnlockProgress: StreakUnlockProgress;

  /* Sub-tier micro-interactions — SSOT */
  microInteractions: MicroInteractions;
}

/* ── Tier labels ── */

const DAILY_ENERGY_TIERS: DailyEnergyTier[] = [
  "cold",
  "spark",
  "warming",
  "burning",
  "blazing",
  "peak",
];

const STREAK_POWER_TIERS: StreakPowerTier[] = [
  "dormant",
  "ember",
  "campfire",
  "inferno",
  "legendary",
];

/* ── Computation ── */

function computeDailyTargetPercent(
  todayByCategory: Record<string, number>,
  categories: UserCategory[]
): number {
  const mainCategories = categories.filter((c) => !c.isSideCategory);
  if (mainCategories.length === 0) return 0;

  let totalPercent = 0;

  for (const cat of mainCategories) {
    if (cat.dailyTargetHours <= 0) continue;
    const logged = todayByCategory[cat.name] || 0;
    totalPercent += Math.min(logged / cat.dailyTargetHours, 1);
  }

  const categoriesWithTargets = mainCategories.filter(
    (c) => c.dailyTargetHours > 0
  );

  if (categoriesWithTargets.length === 0) return 0;

  return (totalPercent / categoriesWithTargets.length) * 100;
}

function deriveDailyEnergy(
  todayTargetPercent: number,
  todayLogCount: number
): DailyEnergy {
  if (todayLogCount === 0) return 0;
  if (todayTargetPercent >= 100) return 5;
  if (todayTargetPercent >= 75) return 4;
  if (todayTargetPercent >= 50) return 3;
  if (todayTargetPercent >= 25) return 2;
  return 1;
}

function computeStreak(
  logs: DashboardLog[],
  categories: UserCategory[]
): {
  streak: number;
  streakUnlockProgress: StreakUnlockProgress;
} {
  const dailyTotals: Record<string, number> = {};
  for (const log of logs) {
    dailyTotals[log.date] = (dailyTotals[log.date] || 0) + log.hours;
  }

  const activeCategories = categories.filter((c) => !c.isSideCategory);
  let totalTargetHours = 0;
  for (const cat of activeCategories) {
    totalTargetHours += cat.dailyTargetHours;
  }
  const unlockThreshold = totalTargetHours > 0 ? totalTargetHours * 0.2 : 0.01;

  const today = new Date();
  const todayStr = formatLocalDate(today);
  const todayHours = dailyTotals[todayStr] || 0;

  const isUnlocked = todayHours >= unlockThreshold;
  const remainingHours = Math.max(0, unlockThreshold - todayHours);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const yesterday = new Date(ty, tm - 1, td - 1, 12, 0, 0);
  const yesterdayStr = formatLocalDate(yesterday);
  const qualifiedYesterday = (dailyTotals[yesterdayStr] || 0) >= 0.01;

  let streak = 0;

  if (logs.length > 0) {
    const firstDateStr = logs.reduce((min, log) => log.date < min ? log.date : min, logs[0].date);
    
    // Parse safely to avoid timezone leaps
    const [fy, fm, fd] = firstDateStr.split("-").map(Number);
    const iterDate = new Date(fy, fm - 1, fd, 12, 0, 0);
    const endDate = new Date(ty, tm - 1, td, 12, 0, 0);

    while (iterDate <= endDate) {
      const dStr = formatLocalDate(iterDate);
      const hours = dailyTotals[dStr] || 0;

      // For historical logs, any logged work (> 0) counts. 20% threshold is strictly for today.
      const requiredHours = (dStr >= todayStr) ? unlockThreshold : 0.01;

      if (hours >= requiredHours) {
        streak++;
      } else {
        if (dStr !== todayStr) {
          streak = Math.max(0, streak - 2);
        }
      }

      iterDate.setDate(iterDate.getDate() + 1);
    }
  }

  const status: StreakUnlockProgress["status"] = isUnlocked
    ? "secured"
    : logs.length > 0 && !qualifiedYesterday
      ? "revivable"
      : "continuing";
  const projectedStreak = isUnlocked ? streak : streak + 1;

  return {
    streak,
    streakUnlockProgress: {
      isUnlocked,
      targetHours: unlockThreshold,
      currentHours: todayHours,
      remainingHours,
      status,
      projectedStreak,
    }
  };
}

function deriveStreakPower(streakDays: number): StreakPower {
  if (streakDays >= 11) return 4;
  if (streakDays >= 6) return 3;
  if (streakDays >= 3) return 2;
  if (streakDays >= 1) return 1;
  return 0;
}

export function deriveMicroInteractions(
  dailyEnergy: DailyEnergy,
  streakPower: StreakPower,
  streakDays: number
): MicroInteractions {
  /* ── Hover (energy-driven) ── */
  const hoverLift = dailyEnergy >= 1;
  const hoverGlow = dailyEnergy >= 2;
  const hoverRipple = streakPower === 2 && streakDays >= 4; // Forge day 4+

  /* ── Card entrance (streak/tier-driven) ── */
  let cardEntrance: CardEntrance = "none";
  if (streakPower === 1) cardEntrance = "fade";               // Ember
  else if (streakPower === 2) cardEntrance = "slide-up";      // Forge
  else if (streakPower === 3) cardEntrance = "float-down";    // Sky
  else if (streakPower === 4) cardEntrance = "slow-fade";     // Obsidian

  /* ── Celebrations (energy-driven) ── */
  const completionPulse = dailyEnergy >= 3;
  const progressShimmer = dailyEnergy >= 4;
  const confetti = dailyEnergy === 5;

  /* ── Scroll (streak-driven) ── */
  const smoothScroll = streakPower >= 1 && streakDays >= 2;   // Ember day 2+
  const parallaxBg = streakPower === 3 && streakDays >= 8;    // Sky day 8+

  /* ── Sound (streak-driven, later tiers only) ── */
  let completionSound: CompletionSound = "none";
  if (streakPower === 2 && streakDays >= 5) completionSound = "forge-hammer";
  else if (streakPower === 3 && streakDays >= 10) completionSound = "wind-chime";
  else if (streakPower === 4 && streakDays >= 21) completionSound = "deep-resonance";

  /* ── Badge float (tier-driven, progressive skin evolution) ── */
  let badgeFloat: BadgeFloat = "none";
  if (streakPower === 1 && streakDays >= 2) badgeFloat = "subtle";     // Ember day 2+
  else if (streakPower === 2) badgeFloat = "gentle";                   // Forge
  else if (streakPower === 3) badgeFloat = "calm";                     // Sky
  else if (streakPower === 4) badgeFloat = "still";                    // Obsidian — barely moves

  return {
    hoverLift, hoverGlow, hoverRipple,
    cardEntrance,
    completionPulse, progressShimmer, confetti,
    smoothScroll, parallaxBg,
    completionSound,
    badgeFloat,
  };
}

/**
 * The single source of truth for all log-derived metrics on the dashboard.
 * Call once, consume everywhere.
 */
export function computeMomentum(
  logs: DashboardLog[],
  categories: UserCategory[]
): MomentumState {
  const today = formatLocalDate(new Date());
  const weekStart = formatLocalDate(getWeekStart());

  /* Today aggregates */
  const todayByCategory: Record<string, number> = {};
  let todayLogCount = 0;

  /* Weekly aggregates */
  const weeklyByCategory: Record<string, number> = {};

  for (const log of logs) {
    if (log.date === today) {
      todayByCategory[log.category] =
        (todayByCategory[log.category] || 0) + log.hours;
      todayLogCount++;
    }
    if (log.date >= weekStart) {
      weeklyByCategory[log.category] =
        (weeklyByCategory[log.category] || 0) + log.hours;
    }
  }

  const todayHours = Object.values(todayByCategory).reduce(
    (s, h) => s + h,
    0
  );
  const weeklyHours = Object.values(weeklyByCategory).reduce(
    (s, h) => s + h,
    0
  );

  const todayTargetPercent = computeDailyTargetPercent(
    todayByCategory,
    categories
  );

  const { streak: streakDays, streakUnlockProgress } = computeStreak(logs, categories);
  const dailyEnergy = deriveDailyEnergy(todayTargetPercent, todayLogCount);
  const streakPower = deriveStreakPower(streakDays);
  const microInteractions = deriveMicroInteractions(dailyEnergy, streakPower, streakDays);

  return {
    dailyEnergy,
    dailyEnergyTier: DAILY_ENERGY_TIERS[dailyEnergy],
    streakPower,
    streakPowerTier: STREAK_POWER_TIERS[streakPower],
    todayHours,
    todayByCategory,
    todayTargetPercent,
    todayLogCount,
    weeklyHours,
    weeklyByCategory,
    streakDays,
    streakUnlockProgress,
    microInteractions,
  };
}
