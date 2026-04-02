export const SMART_RECALL_RARITIES = ["spark", "forge", "boss"] as const;
export const SMART_RECALL_STATUSES = [
  "due",
  "snoozed",
  "completed",
] as const;
export const SMART_RECALL_ELIGIBILITY_STATUSES = [
  "pending",
  "eligible",
  "ineligible",
] as const;
export const SMART_RECALL_STATES = [
  "locked",
  "ready",
  "scheduled",
  "cleared",
] as const;

export const SMART_RECALL_UNLOCK_LOGS = 3;
export const SMART_RECALL_SNOOZE_MS = 60 * 60 * 1000;
export const SMART_RECALL_MAX_ELIGIBLE_LOGS = 18;
export const SMART_RECALL_LOG_SAVED_EVENT = "disciplog:log-saved";
export const SMART_RECALL_ELIGIBILITY_VERSION = 1;

export type SmartRecallRarity = (typeof SMART_RECALL_RARITIES)[number];
export type SmartRecallStatus = (typeof SMART_RECALL_STATUSES)[number];
export type SmartRecallEligibilityStatus =
  (typeof SMART_RECALL_ELIGIBILITY_STATUSES)[number];
export type SmartRecallState = (typeof SMART_RECALL_STATES)[number];

export interface SmartRecallCardView {
  id: string;
  sourceLogId: string;
  title: string;
  prompt: string;
  answer: string;
  why: string;
  category: string;
  sourceDate: string;
  rarity: SmartRecallRarity;
  status: SmartRecallStatus;
  dueAt: string | null;
  completedAt: string | null;
  lastViewedAt: string | null;
  snoozeCount: number;
}

export interface SmartRecallSummary {
  state: SmartRecallState;
  pendingCount: number;
  dueCount: number;
  completedTodayCount: number;
  nextDueAt: string | null;
  tutorialSeen: boolean;
  activeCard: SmartRecallCardView | null;
  logsUntilUnlock: number;
  unlockProgress: {
    currentLogs: number;
    requiredLogs: number;
  };
  queue: {
    due: SmartRecallCardView[];
    snoozed: SmartRecallCardView[];
    completedToday: SmartRecallCardView[];
  };
}
