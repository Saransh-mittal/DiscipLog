export const LOG_CATEGORIES = [
  "Interview Prep",
  "Building",
  "Learning",
  "Shipping",
  "Other",
] as const;

export const LOG_SOURCES = ["manual", "sprint"] as const;

export const SPRINT_COMPLETION_STATUSES = [
  "completed",
  "finished_early",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];
export type LogSource = (typeof LOG_SOURCES)[number];
export type SprintCompletionStatus =
  (typeof SPRINT_COMPLETION_STATUSES)[number];

export interface DashboardLog {
  _id: string;
  date: string;
  hours: number;
  category: LogCategory;
  rawTranscript: string;
  aiSummary?: string;
  source?: LogSource;
  plannedMinutes?: number;
  actualMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  completionStatus?: SprintCompletionStatus;
  loggedAt?: string;
  createdAt?: string;
}

export function isValidLogCategory(category: string): category is LogCategory {
  return LOG_CATEGORIES.includes(category as LogCategory);
}

export function isValidLogSource(source: string): source is LogSource {
  return LOG_SOURCES.includes(source as LogSource);
}

export function isValidSprintCompletionStatus(
  status: string
): status is SprintCompletionStatus {
  return SPRINT_COMPLETION_STATUSES.includes(status as SprintCompletionStatus);
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseLogInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function deriveLogDate(loggedAt: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(loggedAt);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to derive date bucket for timezone");
  }

  return `${year}-${month}-${day}`;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getLogTimestampValue(log: {
  loggedAt?: string | Date | null;
  createdAt?: string | Date | null;
}): Date | null {
  return parseLogInstant(log.loggedAt) ?? parseLogInstant(log.createdAt);
}

export function sortLogsByTimestamp<T extends DashboardLog>(logs: T[]): T[] {
  return [...logs].sort((a, b) => {
    const timeA = getLogTimestampValue(a)?.getTime() ?? 0;
    const timeB = getLogTimestampValue(b)?.getTime() ?? 0;
    return timeB - timeA;
  });
}
