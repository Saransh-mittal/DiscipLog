import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import connectToDatabase from "@/lib/mongoose";
import { getBaselineCoachContext } from "@/lib/coach-context";
import { getDateKeyInTimezone, isValidTimezone } from "@/lib/logs";
import { getStoredAIProfile } from "@/lib/ai-profile";
import LogEntry from "@/models/LogEntry";
import User from "@/models/User";

const MAX_RECALL_SOURCE_LOGS = 18;
const MAX_TODAY_REVIEW_LOGS = 12;

const recallCardSchema = z.object({
  title: z.string().min(3).max(80),
  prompt: z.string().min(8).max(220),
  answer: z.string().min(8).max(260),
  why: z.string().min(8).max(180),
  category: z.string().min(1).max(80),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rarity: z.enum(["spark", "forge", "boss"]),
});

const recallResponseSchema = z.object({
  cards: z.array(recallCardSchema).min(3).max(5),
});

interface InsightLog {
  _id: unknown;
  date: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string | null;
  loggedAt?: Date | string | null;
  createdAt?: Date | string | null;
  source?: string;
}

export type RecallCard = z.infer<typeof recallCardSchema>;

export interface DailyRecallFeed {
  dateKey: string;
  cards: RecallCard[];
  fallbackUsed: boolean;
}

export interface EndOfDayReview {
  dateKey: string;
  markdown: string;
  todayTotalHours: number;
  todayLogCount: number;
  fallbackUsed: boolean;
}

const recallCache = new Map<string, DailyRecallFeed>();
const reviewCache = new Map<string, EndOfDayReview>();

function cleanJsonResponse(text: string): string {
  return text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxChars: number): string {
  return normalizeWhitespace(value).slice(0, maxChars);
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function getResolvedTimezone(timezone: string | null | undefined): string {
  return isValidTimezone(timezone || "") ? (timezone as string) : "Asia/Kolkata";
}

function buildLogLabel(log: InsightLog, timezone: string): string {
  const timestamp = log.loggedAt || log.createdAt;
  const timeLabel = timestamp
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(timestamp))
    : "unknown time";

  return `${log.date} at ${timeLabel}`;
}

function buildRecallSourcePayload(logs: InsightLog[], timezone: string): string {
  return logs
    .map((log, index) => {
      const summary = truncateText(
        log.aiSummary || log.rawTranscript || "No summary available.",
        240
      );

      return [
        `Log ${index + 1}`,
        `- Date: ${buildLogLabel(log, timezone)}`,
        `- Category: ${log.category}`,
        `- Duration: ${roundHours(log.hours)}h`,
        `- Summary: ${summary}`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildRecallCacheKey(input: {
  userId: string;
  timezone: string;
  dateKey: string;
  logs: InsightLog[];
}): string {
  const firstLog = input.logs[0];
  return [
    input.userId,
    input.timezone,
    input.dateKey,
    input.logs.length,
    firstLog ? String(firstLog._id) : "none",
  ].join(":");
}

function buildReviewCacheKey(input: {
  userId: string;
  timezone: string;
  dateKey: string;
  logs: InsightLog[];
}): string {
  const firstLog = input.logs[0];
  return [
    input.userId,
    input.timezone,
    input.dateKey,
    input.logs.length,
    firstLog ? String(firstLog._id) : "none",
  ].join(":");
}

function buildFallbackRecallCards(logs: InsightLog[]): RecallCard[] {
  return logs.slice(0, 4).map((log, index) => {
    const summary = truncateText(
      log.aiSummary || log.rawTranscript || "No summary available.",
      190
    );
    const rarity: RecallCard["rarity"] =
      /accepted|solved|fixed|shipped|completed/i.test(summary)
        ? "boss"
        : /pattern|rule|heuristic|tradeoff|architecture|debug/i.test(summary)
          ? "forge"
          : "spark";

    return {
      title: truncateText(`${log.category} Recall ${index + 1}`, 48),
      prompt: truncateText(
        `What is the main pattern, fix, or lesson from this ${log.category} session?`,
        180
      ),
      answer: summary,
      why: truncateText(
        `This card is grounded in your ${log.date} ${log.category} work and keeps a recent lesson easy to revisit.`,
        160
      ),
      category: log.category,
      sourceDate: log.date,
      rarity,
    };
  });
}

function formatTargetPressureSummary(input: {
  categories: Array<{
    name: string;
    weeklyMinTarget: number;
    weeklyMaxTarget: number;
  }>;
  weeklyByCategory: Array<{
    category: string;
    totalHours: number;
  }>;
}): string {
  const hoursByCategory = new Map(
    input.weeklyByCategory.map((item) => [item.category, item.totalHours])
  );

  return input.categories
    .map((category) => {
      const actualHours = hoursByCategory.get(category.name) ?? 0;
      const gapToMin = Math.max(0, roundHours(category.weeklyMinTarget - actualHours));
      return `- ${category.name}: ${roundHours(actualHours)}h logged this week, target ${category.weeklyMinTarget}-${category.weeklyMaxTarget}h, gap to min ${gapToMin}h`;
    })
    .join("\n");
}

function buildFallbackEndOfDayMarkdown(input: {
  todayLogs: InsightLog[];
  todayTotalHours: number;
  topCategory: string | null;
  targetPressureSummary: string;
}): string {
  const recentHighlights = input.todayLogs
    .slice(0, 3)
    .map((log) => `- ${log.category}: ${truncateText(log.aiSummary || log.rawTranscript, 120)}`)
    .join("\n");

  return [
    "## XP Earned",
    `You closed the day with **${roundHours(input.todayTotalHours)}h** across **${input.todayLogs.length} log${input.todayLogs.length === 1 ? "" : "s"}**.`,
    input.topCategory
      ? `Your main lane tonight was **${input.topCategory}**.`
      : "You moved multiple lanes forward tonight.",
    "",
    "## Boss Fight",
    recentHighlights || "- No major boss fight surfaced from the logs yet.",
    "",
    "## Mental Model",
    "Name the repeatable rule from today, not just the task you touched. Ask: what would still help tomorrow if the exact task changed?",
    "",
    "## Momentum Meter",
    "Use this as your balance check against weekly targets:",
    input.targetPressureSummary,
    "",
    "## Tomorrow Spawn Point",
    "- Start with the freshest unfinished thread from tonight.",
    "- Spend the first 10 minutes recalling the rule or fix before opening a new rabbit hole.",
  ].join("\n");
}

async function loadUserProfile(userId: string) {
  const user = await User.findById(userId)
    .select("aiProfile")
    .lean<{ aiProfile?: unknown } | null>();

  return getStoredAIProfile(user?.aiProfile);
}

async function loadRecentLogs(userId: string, limit: number): Promise<InsightLog[]> {
  return LogEntry.find({ userId })
    .sort({ loggedAt: -1, createdAt: -1 })
    .limit(limit)
    .select("date hours category aiSummary rawTranscript loggedAt createdAt source")
    .lean<InsightLog[]>();
}

async function loadTodayLogs(userId: string, todayDateKey: string): Promise<InsightLog[]> {
  return LogEntry.find({ userId, date: todayDateKey })
    .sort({ loggedAt: -1, createdAt: -1 })
    .limit(MAX_TODAY_REVIEW_LOGS)
    .select("date hours category aiSummary rawTranscript loggedAt createdAt source")
    .lean<InsightLog[]>();
}

export async function generateDailyRecallFeed(input: {
  userId: string;
  timezone?: string | null;
}): Promise<DailyRecallFeed> {
  await connectToDatabase();

  const timezone = getResolvedTimezone(input.timezone);
  const dateKey = getDateKeyInTimezone(timezone);
  const recentLogs = await loadRecentLogs(input.userId, MAX_RECALL_SOURCE_LOGS);

  if (recentLogs.length === 0) {
    return { dateKey, cards: [], fallbackUsed: true };
  }

  const cacheKey = buildRecallCacheKey({
    userId: input.userId,
    timezone,
    dateKey,
    logs: recentLogs,
  });
  const cached = recallCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const profile = await loadUserProfile(input.userId);
  const fallbackCards = buildFallbackRecallCards(recentLogs);

  try {
    const result = await generateText({
      model: openai("gpt-5-nano"),
      system: `You create daily smart recall cards for a productivity dashboard.

Return ONLY valid JSON with this shape:
{"cards":[{"title":"","prompt":"","answer":"","why":"","category":"","sourceDate":"YYYY-MM-DD","rarity":"spark|forge|boss"}]}

Rules:
- Generate 3 to 5 cards.
- Use ONLY the provided logs. Do not invent facts.
- Prefer durable lessons: patterns, fixes, mistakes, debugging lessons, architecture decisions, accepted solutions, or shipped work.
- Avoid redundant cards that ask the same thing twice.
- Prompts should feel like active recall, not summaries.
- Answers should be concise and specific.
- "why" should explain why the card matters now.
- Keep the tone sharp, useful, and lightly game-like, not cheesy.`,
      prompt: `Today: ${dateKey}
Timezone: ${timezone}
User core why: ${profile.coreWhy || "Not provided"}

Recent logs:
${buildRecallSourcePayload(recentLogs, timezone)}

Create the daily recall feed now. JSON only.`,
    });

    const parsed = recallResponseSchema.parse(
      JSON.parse(cleanJsonResponse(result.text))
    );

    const feed: DailyRecallFeed = {
      dateKey,
      cards: parsed.cards,
      fallbackUsed: false,
    };

    recallCache.set(cacheKey, feed);
    return feed;
  } catch {
    const fallback: DailyRecallFeed = {
      dateKey,
      cards: fallbackCards,
      fallbackUsed: true,
    };
    recallCache.set(cacheKey, fallback);
    return fallback;
  }
}

export async function generateEndOfDayReview(input: {
  userId: string;
  timezone?: string | null;
}): Promise<EndOfDayReview> {
  await connectToDatabase();

  const timezone = getResolvedTimezone(input.timezone);
  const baselineContext = await getBaselineCoachContext({
    userId: input.userId,
    timezone,
  });
  const todayLogs = await loadTodayLogs(input.userId, baselineContext.todayDateKey);

  const cacheKey = buildReviewCacheKey({
    userId: input.userId,
    timezone,
    dateKey: baselineContext.todayDateKey,
    logs: todayLogs,
  });
  const cached = reviewCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const todayTotalHours = roundHours(
    todayLogs.reduce((sum, log) => sum + log.hours, 0)
  );
  const topCategory =
    [...todayLogs]
      .sort((a, b) => b.hours - a.hours)
      .map((log) => log.category)[0] ?? null;
  const profile = await loadUserProfile(input.userId);
  const targetPressureSummary = formatTargetPressureSummary({
    categories: baselineContext.userCategories,
    weeklyByCategory: baselineContext.structuredStats.weeklyByCategory.map((item) => ({
      category: item.category,
      totalHours: item.totalHours,
    })),
  });

  if (todayLogs.length === 0) {
    const emptyReview: EndOfDayReview = {
      dateKey: baselineContext.todayDateKey,
      markdown: [
        "## XP Earned",
        "No focus blocks were logged yet today.",
        "",
        "## Mental Model",
        "Your nightly review unlocks after the first completed log. Give the system one real session and it can reflect the day back to you.",
        "",
        "## Tomorrow Spawn Point",
        "- Open with one small, winnable sprint.",
        "- Write one concrete outcome so tomorrow has something real to build on.",
      ].join("\n"),
      todayTotalHours: 0,
      todayLogCount: 0,
      fallbackUsed: true,
    };

    reviewCache.set(cacheKey, emptyReview);
    return emptyReview;
  }

  const fallbackMarkdown = buildFallbackEndOfDayMarkdown({
    todayLogs,
    todayTotalHours,
    topCategory,
    targetPressureSummary,
  });

  try {
    const result = await generateText({
      model: openai("gpt-5-nano"),
      system: `You write a compact end-of-day micro review for a productivity app.

Return markdown only.

Use this exact section structure:
## XP Earned
## Boss Fight
## Mental Model
## Momentum Meter
## Tomorrow Spawn Point

Rules:
- Be grounded in the provided logs and stats only.
- Sound reflective, sharp, and lightly gamified. Not cheesy.
- The "Mental Model" section must name one reusable principle from the day.
- The "Momentum Meter" section should comment on category balance, focus quality, or weekly pressure.
- Keep the whole review concise but not dry.
- Use bullets where useful.
- Do not add intro or outro text outside the sections.`,
      prompt: `Today: ${baselineContext.todayDateKey}
Timezone: ${timezone}
User core why: ${profile.coreWhy || "Not provided"}
Selected coach persona: ${profile.persona}
Today's total hours: ${todayTotalHours}
Today's log count: ${todayLogs.length}

Today's logs:
${buildRecallSourcePayload(todayLogs, timezone)}

Weekly target pressure:
${targetPressureSummary}

Recent memory:
${baselineContext.memoryContext || "None"}

Write the end-of-day micro review now in markdown.`,
    });

    const review: EndOfDayReview = {
      dateKey: baselineContext.todayDateKey,
      markdown: result.text.trim() || fallbackMarkdown,
      todayTotalHours,
      todayLogCount: todayLogs.length,
      fallbackUsed: !result.text.trim(),
    };

    reviewCache.set(cacheKey, review);
    return review;
  } catch {
    const review: EndOfDayReview = {
      dateKey: baselineContext.todayDateKey,
      markdown: fallbackMarkdown,
      todayTotalHours,
      todayLogCount: todayLogs.length,
      fallbackUsed: true,
    };
    reviewCache.set(cacheKey, review);
    return review;
  }
}
