import connectToDatabase from "@/lib/mongoose";
import LogEntry from "@/models/LogEntry";
import User from "@/models/User";

const LOOKBACK_DAYS = 14;
const MAX_SAMPLE_SIZE = 14;
const RECALC_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// Default nudge times for new users (0-23 hours, user-local)
export const NEW_USER_EARLY_SPARK_HOUR = 14; // 2 PM
export const NEW_USER_EVENING_CHECK_HOUR = 18; // 6 PM

// Deviation windows based on data maturity
const DEVIATION_WINDOW_THIN = 3; // hours — for sampleSize < 5
const DEVIATION_WINDOW_MEDIUM = 2; // hours — for sampleSize 5-9
const DEVIATION_WINDOW_MATURE = 1.5; // hours — for sampleSize >= 10

export interface UsagePattern {
  avgLogHour: number | null;
  dayOfWeekAvgHour: (number | null)[];
  sampleSize: number;
  lastCalculatedAt: Date | null;
  inferredTimezone: string;
}

export function getDeviationWindow(sampleSize: number): number {
  if (sampleSize < 5) return DEVIATION_WINDOW_THIN;
  if (sampleSize < 10) return DEVIATION_WINDOW_MEDIUM;
  return DEVIATION_WINDOW_MATURE;
}

export function getExpectedLogHour(
  pattern: UsagePattern,
  dayOfWeek: number // 0 = Monday, 6 = Sunday
): number | null {
  if (pattern.sampleSize < 3 || pattern.avgLogHour === null) {
    return null;
  }

  // Use day-specific average if available, else global average
  const dayAvg = pattern.dayOfWeekAvgHour[dayOfWeek];
  return dayAvg ?? pattern.avgLogHour;
}

function extractHourFromTimestamp(timestamp: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(timestamp);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;

    if (!hour) return timestamp.getHours();
    return Number(hour) + Number(minute || 0) / 60;
  } catch {
    return timestamp.getHours();
  }
}

function getDayOfWeekFromTimestamp(
  timestamp: Date,
  timezone: string
): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    });
    const weekday = formatter.format(timestamp);
    const map: Record<string, number> = {
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
      Sunday: 6,
    };
    return map[weekday] ?? 0;
  } catch {
    return 0;
  }
}

function computeAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function recalculateUsagePattern(
  userId: string,
  timezone?: string
): Promise<void> {
  try {
    await connectToDatabase();

    // Check cooldown
    const user = await User.findById(userId)
      .select("usagePattern")
      .lean<{ usagePattern?: UsagePattern } | null>();

    if (user?.usagePattern?.lastCalculatedAt) {
      const sinceLastCalc =
        Date.now() - new Date(user.usagePattern.lastCalculatedAt).getTime();
      if (sinceLastCalc < RECALC_COOLDOWN_MS) return;
    }

    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const resolvedTimezone =
      timezone || user?.usagePattern?.inferredTimezone || "Asia/Kolkata";

    // Fetch recent logs with timestamps
    const logs = await LogEntry.find({
      userId,
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(MAX_SAMPLE_SIZE * 3) // Fetch more to handle multiple logs per day
      .select("loggedAt createdAt")
      .lean<Array<{ loggedAt?: Date; createdAt: Date }>>();

    if (logs.length === 0) return;

    // Extract hours from log timestamps, taking the FIRST log of each day
    const dayFirstLog = new Map<string, { timestamp: Date; hour: number; dayOfWeek: number }>();

    for (const log of logs) {
      const timestamp = log.loggedAt || log.createdAt;
      if (!timestamp) continue;

      const ts = new Date(timestamp);
      const dateKey = ts.toISOString().slice(0, 10);

      if (!dayFirstLog.has(dateKey)) {
        dayFirstLog.set(dateKey, {
          timestamp: ts,
          hour: extractHourFromTimestamp(ts, resolvedTimezone),
          dayOfWeek: getDayOfWeekFromTimestamp(ts, resolvedTimezone),
        });
      }
    }

    const entries = [...dayFirstLog.values()].slice(0, MAX_SAMPLE_SIZE);
    if (entries.length === 0) return;

    // Compute global average
    const allHours = entries.map((e) => e.hour);
    const avgLogHour = computeAverage(allHours);

    // Compute per-day-of-week averages
    const dayOfWeekAvgHour: (number | null)[] = Array(7).fill(null);
    for (let day = 0; day < 7; day++) {
      const dayHours = entries.filter((e) => e.dayOfWeek === day).map((e) => e.hour);
      dayOfWeekAvgHour[day] = computeAverage(dayHours);
    }

    await User.findByIdAndUpdate(userId, {
      $set: {
        "usagePattern.avgLogHour": avgLogHour,
        "usagePattern.dayOfWeekAvgHour": dayOfWeekAvgHour,
        "usagePattern.sampleSize": Math.min(entries.length, MAX_SAMPLE_SIZE),
        "usagePattern.lastCalculatedAt": new Date(),
        "usagePattern.inferredTimezone": resolvedTimezone,
      },
    });
  } catch (error) {
    console.error("[USAGE_PATTERN_RECALC_ERROR]", error);
  }
}

export function scheduleUsagePatternRecalc(userId: string, timezone?: string) {
  queueMicrotask(() => {
    void recalculateUsagePattern(userId, timezone);
  });
}
