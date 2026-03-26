// Legacy categories for backwards compatibility with existing log entries
export const LOG_CATEGORIES = [
  "Interview Prep",
  "Building",
  "Learning",
  "Shipping",
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

// Dynamic user-defined category
export interface UserCategory {
  name: string;
  dailyTargetHours: number;
  weeklyMinTarget: number;
  weeklyMaxTarget: number;
  icon: string;
  isSideCategory?: boolean;
}

export interface DashboardLog {
  _id: string;
  date: string;
  hours: number;
  category: string;
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

export function isValidLogCategory(category: string): boolean {
  return typeof category === "string" && category.trim().length > 0;
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

export interface ZonedDateContext {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  weekday: string;
  dateKey: string;
  timeKey: string;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getUtcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getZonedDateContext(
  date: Date,
  timezone: string
): ZonedDateContext {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  });
  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  const second = parts.find((part) => part.type === "second")?.value;
  const weekday = parts.find((part) => part.type === "weekday")?.value;

  if (!year || !month || !day || !hour || !minute || !second || !weekday) {
    throw new Error("Unable to derive timezone-aware date context");
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    dateKey: `${year}-${month}-${day}`,
    timeKey: `${hour}:${minute}`,
  };
}

export function getDateKeyInTimezone(
  timezone: string,
  date: Date = new Date()
): string {
  return getZonedDateContext(date, timezone).dateKey;
}

export function getWeekStartDateKey(
  timezone: string,
  date: Date = new Date()
): string {
  const zoned = getZonedDateContext(date, timezone);
  const weekdayIndex = WEEKDAY_TO_INDEX[zoned.weekday];

  if (weekdayIndex === undefined) {
    throw new Error("Unable to derive weekday index for timezone");
  }

  const daysFromMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  const mondayUtc = new Date(
    Date.UTC(
      Number(zoned.year),
      Number(zoned.month) - 1,
      Number(zoned.day) - daysFromMonday
    )
  );

  return getUtcDateKey(mondayUtc);
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

export function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
