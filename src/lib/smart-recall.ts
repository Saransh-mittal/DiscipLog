import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import connectToDatabase from "@/lib/mongoose";
import { getStoredAIProfile } from "@/lib/ai-profile";
import { getDateKeyInTimezone, isValidTimezone } from "@/lib/logs";
import SmartRecallCard from "@/models/SmartRecallCard";
import LogEntry from "@/models/LogEntry";
import User from "@/models/User";
import {
  SMART_RECALL_ELIGIBILITY_VERSION,
  SMART_RECALL_MAX_ELIGIBLE_LOGS,
  SMART_RECALL_RARITIES,
  SMART_RECALL_SNOOZE_MS,
  SMART_RECALL_UNLOCK_LOGS,
  type SmartRecallCardView,
  type SmartRecallEligibilityStatus,
  type SmartRecallRarity,
  type SmartRecallSummary,
} from "@/lib/smart-recall-types";

interface RecallEligibilityRecord {
  status?: SmartRecallEligibilityStatus | null;
  reason?: string | null;
  evaluatedAt?: Date | string | null;
  version?: number | null;
}

interface RecallSourceLog {
  _id: unknown;
  userId?: unknown;
  date: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string | null;
  loggedAt?: Date | string | null;
  createdAt?: Date | string | null;
  smartRecallEligibility?: RecallEligibilityRecord | null;
}

interface RecallCardRecord {
  _id: unknown;
  sourceLogId: unknown;
  title: string;
  prompt: string;
  answer: string;
  why: string;
  category: string;
  sourceDate: string;
  rarity: SmartRecallRarity;
  status: "due" | "snoozed" | "completed";
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  lastViewedAt?: Date | string | null;
  snoozeCount?: number | null;
  drawerMessageCount?: number | null;
  createdAt?: Date | string | null;
}

interface GeneratedRecallCard {
  sourceLogId: string;
  title: string;
  prompt: string;
  answer: string;
  why: string;
  category: string;
  sourceDate: string;
  rarity: SmartRecallRarity;
}

interface RecallEligibilityDecision {
  status: Extract<SmartRecallEligibilityStatus, "eligible" | "ineligible">;
  reason: string;
}

const SMART_RECALL_BACKFILL_LIMIT = 24;
const SMART_RECALL_MAX_CLASSIFIER_CHARS = 700;
const SMART_RECALL_MIN_CHARS = 45;
const SMART_RECALL_MIN_WORDS = 8;
const SMART_RECALL_PAYLOAD_SUMMARY_CHARS = 520;
const SMART_RECALL_PAYLOAD_TRANSCRIPT_CHARS = 680;
const SMART_RECALL_PROMPT_MAX_CHARS = 320;
const SMART_RECALL_ANSWER_MAX_CHARS = 720;
const SMART_RECALL_WHY_MAX_CHARS = 220;
const ROUTINE_STATUS_ONLY_RE =
  /\b(accepted|submitted|completed|continued|done|finished|wrapped up|practiced|attempted|reviewed|revised)\b/i;
const DURABLE_DETAIL_RE =
  /\b(because|so that|fixed|debug|bug|issue|root cause|learned|lesson|pattern|tradeoff|decision|approach|insight|heuristic|architecture|designed|implemented|refactor|optimized|why|how|using|with)\b/i;
const UNUSABLE_CARD_RE =
  /\b(no summary available|not enough information|insufficient detail|unclear|unknown)\b/i;

const queuedEligibilityRefreshes = new Set<string>();
const queuedEligibilityBackfills = new Set<string>();

const generatedCardSchema = z.object({
  sourceLogId: z.string().min(1),
  title: z.string().min(3).max(80),
  prompt: z.string().min(8).max(SMART_RECALL_PROMPT_MAX_CHARS),
  answer: z.string().min(8).max(SMART_RECALL_ANSWER_MAX_CHARS),
  why: z.string().min(8).max(SMART_RECALL_WHY_MAX_CHARS),
  category: z.string().min(1).max(80),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rarity: z.enum(SMART_RECALL_RARITIES),
});

const generatedResponseSchema = z.object({
  cards: z.array(generatedCardSchema),
});

const recallEligibilityResponseSchema = z.object({
  eligible: z.boolean(),
  reason: z.string().min(6),
});

function getResolvedTimezone(timezone: string | null | undefined): string {
  return isValidTimezone(timezone || "") ? (timezone as string) : "Asia/Kolkata";
}

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

function parseMaybeDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRecallSourceText(log: Pick<RecallSourceLog, "aiSummary" | "rawTranscript">): string {
  const summary =
    typeof log.aiSummary === "string" && log.aiSummary.trim()
      ? log.aiSummary.trim()
      : "";
  const transcript =
    typeof log.rawTranscript === "string" && log.rawTranscript.trim()
      ? log.rawTranscript.trim()
      : "";

  if (summary && transcript) {
    if (normalizeWhitespace(summary) === normalizeWhitespace(transcript)) {
      return normalizeWhitespace(summary);
    }

    return normalizeWhitespace(`${summary}\n${transcript}`);
  }

  return normalizeWhitespace(summary || transcript);
}

function getWordCount(value: string): number {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function getPendingSmartRecallEligibility() {
  return {
    status: "pending" as const,
    reason: null,
    evaluatedAt: null,
    version: SMART_RECALL_ELIGIBILITY_VERSION,
  };
}

function needsRecallEligibilityRefresh(
  eligibility: RecallEligibilityRecord | null | undefined
): boolean {
  return (
    !eligibility ||
    eligibility.status === "pending" ||
    eligibility.version !== SMART_RECALL_ELIGIBILITY_VERSION
  );
}

function isExplicitlyIneligible(
  eligibility: RecallEligibilityRecord | null | undefined
): boolean {
  return (
    eligibility?.status === "ineligible" &&
    eligibility.version === SMART_RECALL_ELIGIBILITY_VERSION
  );
}

function getHardRejectReason(
  log: Pick<RecallSourceLog, "aiSummary" | "rawTranscript" | "category">
): string | null {
  const sourceText = getRecallSourceText(log);

  if (!sourceText) {
    return "Log is empty, so there is nothing useful to recall.";
  }

  if (
    sourceText.length < SMART_RECALL_MIN_CHARS ||
    getWordCount(sourceText) < SMART_RECALL_MIN_WORDS
  ) {
    return "Log is too short to support a useful recall card.";
  }

  if (
    ROUTINE_STATUS_ONLY_RE.test(sourceText) &&
    !DURABLE_DETAIL_RE.test(sourceText)
  ) {
    return "Log is mostly a routine status update without reusable learning.";
  }

  return null;
}

function buildEligibilityUpdate(decision: RecallEligibilityDecision) {
  return {
    status: decision.status,
    reason: decision.reason,
    evaluatedAt: new Date(),
    version: SMART_RECALL_ELIGIBILITY_VERSION,
  };
}

function buildLogLabel(log: RecallSourceLog, timezone: string): string {
  const timestamp = log.loggedAt || log.createdAt;

  if (!timestamp) {
    return log.date;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function buildPromptPayload(logs: RecallSourceLog[], timezone: string): string {
  return logs
    .map((log, index) => {
      const summary =
        typeof log.aiSummary === "string" && log.aiSummary.trim()
          ? truncateText(log.aiSummary, SMART_RECALL_PAYLOAD_SUMMARY_CHARS)
          : "";
      const transcriptExcerpt =
        typeof log.rawTranscript === "string" && log.rawTranscript.trim()
          ? truncateText(log.rawTranscript, SMART_RECALL_PAYLOAD_TRANSCRIPT_CHARS)
          : "";

      return [
        `Log ${index + 1}`,
        `- sourceLogId: ${String(log._id)}`,
        `- date: ${log.date}`,
        `- label: ${buildLogLabel(log, timezone)}`,
        `- category: ${log.category}`,
        `- duration: ${roundHours(log.hours)}h`,
        `- aiSummary: ${summary || "No AI summary available."}`,
        `- transcriptExcerpt: ${transcriptExcerpt || "No transcript available."}`,
      ].join("\n");
    })
    .join("\n\n");
}

function toCardView(card: RecallCardRecord): SmartRecallCardView {
  return {
    id: String(card._id),
    sourceLogId: String(card.sourceLogId),
    title: card.title,
    prompt: card.prompt,
    answer: card.answer,
    why: card.why,
    category: card.category,
    sourceDate: card.sourceDate,
    rarity: card.rarity,
    status: card.status,
    dueAt: parseMaybeDate(card.dueAt)?.toISOString() ?? null,
    completedAt: parseMaybeDate(card.completedAt)?.toISOString() ?? null,
    lastViewedAt: parseMaybeDate(card.lastViewedAt)?.toISOString() ?? null,
    snoozeCount: card.snoozeCount ?? 0,
    drawerMessageCount: card.drawerMessageCount ?? 0,
  };
}

function isGeneratedCardUsable(card: z.infer<typeof generatedCardSchema>): boolean {
  return !UNUSABLE_CARD_RE.test(`${card.answer} ${card.why}`);
}

async function classifyRecallEligibilityWithModel(
  log: RecallSourceLog
): Promise<RecallEligibilityDecision> {
  const summary = truncateText(getRecallSourceText(log), SMART_RECALL_MAX_CLASSIFIER_CHARS);

  const result = await generateText({
    model: openai("gpt-5-nano"),
    system: `You decide whether a productivity log deserves a future active-recall card.

Return ONLY valid JSON with this shape:
{"eligible":true|false,"reason":"short reason"}

Strict rules:
- Eligible only if the log contains durable value the user would benefit from recalling later.
- Durable value means things like reusable lessons, debugging/root-cause insights, decisions and tradeoffs, concrete techniques or patterns, or meaningful outcomes with enough why/how detail.
- Ineligible if the log is mostly a short status update, routine submission, generic practice, progress blurb, or an outcome without a real lesson.
- Prefer false when uncertain.
- The reason must be plain, specific, and concise.`,
    prompt: `Category: ${log.category}
Duration: ${roundHours(log.hours)}h
Date: ${log.date}
Content:
${summary || "No summary available."}

Should this log produce a smart recall card? JSON only.`,
  });

  const parsed = recallEligibilityResponseSchema.parse(
    JSON.parse(cleanJsonResponse(result.text))
  );

  return {
    status: parsed.eligible ? "eligible" : "ineligible",
    reason: parsed.reason,
  };
}

async function loadRecallUserState(userId: string) {
  const user = await User.findById(userId)
    .select("aiProfile smartRecall")
    .lean<
      | {
          aiProfile?: unknown;
          smartRecall?: { tutorialSeenAt?: Date | string | null } | null;
        }
      | null
    >();

  const profile = getStoredAIProfile(user?.aiProfile);

  return {
    coreWhy: profile.coreWhy,
    tutorialSeen: !!parseMaybeDate(user?.smartRecall?.tutorialSeenAt),
  };
}

async function loadEligibleLogs(userId: string): Promise<RecallSourceLog[]> {
  return LogEntry.find({
    userId,
    "smartRecallEligibility.status": "eligible",
    "smartRecallEligibility.version": SMART_RECALL_ELIGIBILITY_VERSION,
  })
    .sort({ loggedAt: -1, createdAt: -1 })
    .limit(SMART_RECALL_MAX_ELIGIBLE_LOGS)
    .select(
      "date hours category rawTranscript aiSummary loggedAt createdAt smartRecallEligibility"
    )
    .lean<RecallSourceLog[]>();
}

async function generateRecallCardsForLogs(input: {
  logs: RecallSourceLog[];
  timezone: string;
  coreWhy: string;
}): Promise<GeneratedRecallCard[]> {
  if (input.logs.length === 0) {
    return [];
  }

  try {
    const result = await generateText({
      model: openai("gpt-5-nano"),
      system: `You create smart recall cards for a productivity app.

Return ONLY valid JSON with this shape:
{"cards":[{"sourceLogId":"","title":"","prompt":"","answer":"","why":"","category":"","sourceDate":"YYYY-MM-DD","rarity":"spark|forge|boss"}]}

Rules:
- Create at most one card per sourceLogId.
- It is okay to omit a log entirely if it does not support a strong recall card.
- Use ONLY the provided log details. Do not invent facts.
- Skip routine status updates, thin progress blurbs, generic accepted/submitted notes, or anything without durable learning.
- Make prompts feel like active recall, not passive summaries.
- Prefer durable lessons: patterns, rules, fixes, tradeoffs, architecture moves, debugging lessons, or meaningful shipped outcomes.
- For dense logs, make the recall prompt correspondingly deeper. Ask about the full idea, approach, key decision, and outcome, not just a single isolated detail.
- Answers should feel complete. Cover the main understanding from the log in 2-5 crisp sentences, including the approach, important detail, and outcome when present.
- If the log spans multiple important points, synthesize them into one cohesive answer instead of a one-line fragment.
- Format both the 'prompt' and 'answer' fields using rich Markdown styling.
- Use a Markdown heading (###) to structure the overarching idea when it heavily clarifies the content.
- VERY IMPORTANT: You MUST insert blank newlines (\\n\\n) before and after any lists, bullet points, or code blocks so that they render correctly in strict markdown parsers. Do not write list items inline without line breaks.
- Use bolding (**text**) for emphasis, true bullet points (starting on new lines) for rules or sequences, and \`code blocks\` or \`\`\`blocks\`\`\` for any technical details, patterns, or formulas.
- "why" should explain why recalling this matters right now.
- Keep the tone sharp, useful, and lightly game-like, not cheesy.`,
      prompt: `Timezone: ${input.timezone}
User core why: ${input.coreWhy || "Not provided"}

Logs:
${buildPromptPayload(input.logs, input.timezone)}

Create strong smart recall cards now. JSON only.`,
    });

    const parsed = generatedResponseSchema.parse(
      JSON.parse(cleanJsonResponse(result.text))
    );
    const logsBySourceId = new Map(
      input.logs.map((log) => [String(log._id), log] as const)
    );
    const seenSourceIds = new Set<string>();

    return parsed.cards.flatMap((card) => {
      if (seenSourceIds.has(card.sourceLogId) || !isGeneratedCardUsable(card)) {
        return [];
      }

      const sourceLog = logsBySourceId.get(card.sourceLogId);

      if (!sourceLog) {
        return [];
      }

      seenSourceIds.add(card.sourceLogId);

      return [
        {
          sourceLogId: card.sourceLogId,
          title: truncateText(card.title, 80),
          prompt: truncateText(card.prompt, SMART_RECALL_PROMPT_MAX_CHARS),
          answer: truncateText(card.answer, SMART_RECALL_ANSWER_MAX_CHARS),
          why: truncateText(card.why, SMART_RECALL_WHY_MAX_CHARS),
          category: sourceLog.category,
          sourceDate: sourceLog.date,
          rarity: card.rarity,
        },
      ];
    });
  } catch {
    return [];
  }
}

async function ensureRecallCoverage(userId: string, timezone: string) {
  const totalLogs = await LogEntry.countDocuments({ userId });
  const eligibleLogs = await loadEligibleLogs(userId);

  if (totalLogs < SMART_RECALL_UNLOCK_LOGS || eligibleLogs.length === 0) {
    return {
      totalLogs,
      eligibleLogs,
      uncoveredEligibleLogs: [] as RecallSourceLog[],
    };
  }

  const existingCards = await SmartRecallCard.find({
    userId,
    sourceLogId: { $in: eligibleLogs.map((log) => log._id) },
  })
    .select("sourceLogId")
    .lean<Array<{ sourceLogId: unknown }>>();

  const coveredSourceIds = new Set(
    existingCards.map((card) => String(card.sourceLogId))
  );
  const uncoveredEligibleLogs = eligibleLogs.filter(
    (log) => !coveredSourceIds.has(String(log._id))
  );

  if (uncoveredEligibleLogs.length > 0) {
    const userState = await loadRecallUserState(userId);
    const generatedCards = await generateRecallCardsForLogs({
      logs: uncoveredEligibleLogs,
      timezone,
      coreWhy: userState.coreWhy,
    });
    const now = new Date();

    if (generatedCards.length > 0) {
      await SmartRecallCard.bulkWrite(
        generatedCards.map((card) => ({
          updateOne: {
            filter: { userId, sourceLogId: card.sourceLogId },
            update: {
              $setOnInsert: {
                userId,
                sourceLogId: card.sourceLogId,
                title: card.title,
                prompt: card.prompt,
                answer: card.answer,
                why: card.why,
                category: card.category,
                sourceDate: card.sourceDate,
                rarity: card.rarity,
                status: "due",
                dueAt: now,
                completedAt: null,
                lastViewedAt: null,
                snoozeCount: 0,
                drawerMessageCount: 0,
              },
            },
            upsert: true,
          },
        }))
      );
    }
  }

  return {
    totalLogs,
    eligibleLogs,
    uncoveredEligibleLogs,
  };
}

async function promoteReadySnoozes(userId: string) {
  await SmartRecallCard.updateMany(
    {
      userId,
      status: "snoozed",
      dueAt: { $lte: new Date() },
    },
    {
      $set: { status: "due" },
    }
  );
}

async function pruneInvalidRecallCards(userId: string) {
  const cards = await SmartRecallCard.find({ userId })
    .select("_id sourceLogId")
    .lean<Array<{ _id: unknown; sourceLogId: unknown }>>();

  if (cards.length === 0) {
    return;
  }

  const sourceLogIds = cards.map((card) => card.sourceLogId);
  const sourceLogs = await LogEntry.find({
    userId,
    _id: { $in: sourceLogIds },
  })
    .select("rawTranscript aiSummary category smartRecallEligibility")
    .lean<
      Array<{
        _id: unknown;
        rawTranscript: string;
        aiSummary?: string | null;
        category: string;
        smartRecallEligibility?: RecallEligibilityRecord | null;
      }>
    >();

  const logsById = new Map(sourceLogs.map((log) => [String(log._id), log]));
  const cardIdsToDelete: string[] = [];
  const logsToMarkIneligible = new Map<string, string>();
  let needsBackfill = false;

  for (const card of cards) {
    const sourceLogId = String(card.sourceLogId);
    const sourceLog = logsById.get(sourceLogId);

    if (!sourceLog) {
      cardIdsToDelete.push(String(card._id));
      continue;
    }

    const hardRejectReason = getHardRejectReason(sourceLog);

    if (hardRejectReason) {
      cardIdsToDelete.push(String(card._id));
      logsToMarkIneligible.set(sourceLogId, hardRejectReason);
      continue;
    }

    if (isExplicitlyIneligible(sourceLog.smartRecallEligibility)) {
      cardIdsToDelete.push(String(card._id));
      continue;
    }

    if (needsRecallEligibilityRefresh(sourceLog.smartRecallEligibility)) {
      needsBackfill = true;
    }
  }

  if (logsToMarkIneligible.size > 0) {
    await LogEntry.bulkWrite(
      Array.from(logsToMarkIneligible.entries()).map(([logId, reason]) => ({
        updateOne: {
          filter: { _id: logId, userId },
          update: {
            $set: {
              smartRecallEligibility: buildEligibilityUpdate({
                status: "ineligible",
                reason,
              }),
            },
          },
        },
      }))
    );
  }

  if (cardIdsToDelete.length > 0) {
    await SmartRecallCard.deleteMany({
      _id: { $in: cardIdsToDelete },
    });
  }

  if (needsBackfill) {
    scheduleSmartRecallEligibilityBackfill(userId);
  }
}

async function buildSmartRecallSummary(
  userId: string,
  timezone: string
): Promise<SmartRecallSummary> {
  scheduleSmartRecallEligibilityBackfill(userId);
  await pruneInvalidRecallCards(userId);

  const userState = await loadRecallUserState(userId);
  const { totalLogs } = await ensureRecallCoverage(userId, timezone);

  if (totalLogs < SMART_RECALL_UNLOCK_LOGS) {
    return {
      state: "locked",
      pendingCount: 0,
      dueCount: 0,
      completedTodayCount: 0,
      nextDueAt: null,
      tutorialSeen: userState.tutorialSeen,
      activeCard: null,
      logsUntilUnlock: SMART_RECALL_UNLOCK_LOGS - totalLogs,
      unlockProgress: {
        currentLogs: totalLogs,
        requiredLogs: SMART_RECALL_UNLOCK_LOGS,
      },
      queue: {
        due: [],
        snoozed: [],
        completedToday: [],
      },
    };
  }

  return buildSmartRecallSummaryLightweight(userId, timezone);
}

/**
 * Lightweight variant that skips coverage generation and pruning.
 * Use this after card actions (snooze/complete) where new card generation is unnecessary.
 */
async function buildSmartRecallSummaryLightweight(
  userId: string,
  timezone: string
): Promise<SmartRecallSummary> {
  const userState = await loadRecallUserState(userId);
  const totalLogs = await LogEntry.countDocuments({ userId });

  if (totalLogs < SMART_RECALL_UNLOCK_LOGS) {
    return {
      state: "locked",
      pendingCount: 0,
      dueCount: 0,
      completedTodayCount: 0,
      nextDueAt: null,
      tutorialSeen: userState.tutorialSeen,
      activeCard: null,
      logsUntilUnlock: SMART_RECALL_UNLOCK_LOGS - totalLogs,
      unlockProgress: {
        currentLogs: totalLogs,
        requiredLogs: SMART_RECALL_UNLOCK_LOGS,
      },
      queue: {
        due: [],
        snoozed: [],
        completedToday: [],
      },
    };
  }

  await promoteReadySnoozes(userId);

  const [dueCards, snoozedCards, completedCards] = await Promise.all([
    SmartRecallCard.find({ userId, status: "due" })
      .sort({ dueAt: 1, createdAt: 1 })
      .lean<RecallCardRecord[]>(),
    SmartRecallCard.find({ userId, status: "snoozed" })
      .sort({ dueAt: 1, createdAt: 1 })
      .lean<RecallCardRecord[]>(),
    SmartRecallCard.find({ userId, completedAt: { $ne: null } })
      .sort({ completedAt: -1 })
      .limit(SMART_RECALL_MAX_ELIGIBLE_LOGS)
      .lean<RecallCardRecord[]>(),
  ]);

  const todayDateKey = getDateKeyInTimezone(timezone);
  const completedToday = completedCards.filter((card) => {
    const completedAt = parseMaybeDate(card.completedAt);
    if (!completedAt) {
      return false;
    }
    return getDateKeyInTimezone(timezone, completedAt) === todayDateKey;
  });

  const state =
    dueCards.length > 0
      ? "ready"
      : snoozedCards.length > 0
        ? "scheduled"
        : "cleared";

  return {
    state,
    pendingCount: dueCards.length + snoozedCards.length,
    dueCount: dueCards.length,
    completedTodayCount: completedToday.length,
    nextDueAt: parseMaybeDate(snoozedCards[0]?.dueAt)?.toISOString() ?? null,
    tutorialSeen: userState.tutorialSeen,
    activeCard: dueCards[0] ? toCardView(dueCards[0]) : null,
    logsUntilUnlock: 0,
    unlockProgress: {
      currentLogs: totalLogs,
      requiredLogs: SMART_RECALL_UNLOCK_LOGS,
    },
    queue: {
      due: dueCards.map(toCardView),
      snoozed: snoozedCards.map(toCardView),
      completedToday: completedToday.map(toCardView),
    },
  };
}

export async function refreshSmartRecallEligibilityForLog(
  logId: string
): Promise<void> {
  try {
    await connectToDatabase();

    const log = await LogEntry.findById(logId)
      .select(
        "userId date hours category rawTranscript aiSummary loggedAt createdAt smartRecallEligibility"
      )
      .lean<RecallSourceLog | null>();

    if (!log) {
      return;
    }

    const hardRejectReason = getHardRejectReason(log);
    const decision =
      hardRejectReason !== null
        ? {
            status: "ineligible" as const,
            reason: hardRejectReason,
          }
        : await classifyRecallEligibilityWithModel(log);

    await LogEntry.findByIdAndUpdate(logId, {
      $set: {
        smartRecallEligibility: buildEligibilityUpdate(decision),
      },
    });

    if (decision.status === "ineligible") {
      await deleteSmartRecallCardsForLog(logId);
    }
  } catch (error) {
    console.error("[SMART_RECALL_ELIGIBILITY_REFRESH_ERROR]", error);
  }
}

export async function backfillSmartRecallEligibilityForUser(
  userId: string,
  limit = SMART_RECALL_BACKFILL_LIMIT
): Promise<void> {
  try {
    await connectToDatabase();

    const [recentLogsNeedingEvaluation, recallCardSourceLogs] = await Promise.all([
      LogEntry.find({
        userId,
        $or: [
          { smartRecallEligibility: { $exists: false } },
          {
            "smartRecallEligibility.version": {
              $ne: SMART_RECALL_ELIGIBILITY_VERSION,
            },
          },
          { "smartRecallEligibility.status": "pending" },
        ],
      })
        .sort({ loggedAt: -1, createdAt: -1 })
        .limit(limit)
        .select("_id")
        .lean<Array<{ _id: unknown }>>(),
      SmartRecallCard.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("sourceLogId")
        .lean<Array<{ sourceLogId: unknown }>>(),
    ]);

    const logIds = new Set<string>();

    for (const log of recentLogsNeedingEvaluation) {
      logIds.add(String(log._id));
    }

    for (const card of recallCardSourceLogs) {
      logIds.add(String(card.sourceLogId));
    }

    for (const logId of logIds) {
      scheduleSmartRecallEligibilityRefresh(logId);
    }
  } catch (error) {
    console.error("[SMART_RECALL_ELIGIBILITY_BACKFILL_ERROR]", error);
  }
}

export function scheduleSmartRecallEligibilityRefresh(logId: string) {
  if (!logId || queuedEligibilityRefreshes.has(logId)) {
    return;
  }

  queuedEligibilityRefreshes.add(logId);

  queueMicrotask(() => {
    queuedEligibilityRefreshes.delete(logId);
    void refreshSmartRecallEligibilityForLog(logId);
  });
}

export function scheduleSmartRecallEligibilityBackfill(userId: string) {
  if (!userId || queuedEligibilityBackfills.has(userId)) {
    return;
  }

  queuedEligibilityBackfills.add(userId);

  queueMicrotask(() => {
    queuedEligibilityBackfills.delete(userId);
    void backfillSmartRecallEligibilityForUser(userId);
  });
}

export async function deleteSmartRecallCardsForLog(logId: string) {
  await connectToDatabase();
  await SmartRecallCard.deleteMany({ sourceLogId: logId });
}

export { getPendingSmartRecallEligibility };

export async function getSmartRecallSummary(input: {
  userId: string;
  timezone?: string | null;
}): Promise<SmartRecallSummary> {
  await connectToDatabase();
  return buildSmartRecallSummary(
    input.userId,
    getResolvedTimezone(input.timezone)
  );
}

export async function completeSmartRecallCard(input: {
  userId: string;
  cardId: string;
  timezone?: string | null;
}): Promise<SmartRecallSummary | null> {
  await connectToDatabase();

  const updated = await SmartRecallCard.findOneAndUpdate(
    { _id: input.cardId, userId: input.userId },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        lastViewedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!updated) {
    return null;
  }

  return buildSmartRecallSummaryLightweight(
    input.userId,
    getResolvedTimezone(input.timezone)
  );
}

export async function snoozeSmartRecallCard(input: {
  userId: string;
  cardId: string;
  timezone?: string | null;
}): Promise<SmartRecallSummary | null> {
  await connectToDatabase();

  // Get the card state BEFORE the update so we can read drawerMessageCount
  // without an extra query — returnDocument: "before" gives us the pre-update doc.
  const before = await SmartRecallCard.findOneAndUpdate(
    { _id: input.cardId, userId: input.userId },
    {
      $set: {
        status: "snoozed",
        dueAt: new Date(Date.now() + SMART_RECALL_SNOOZE_MS),
        lastViewedAt: new Date(),
      },
      $inc: {
        snoozeCount: 1,
      },
    },
    { returnDocument: "before" }
  ).lean<RecallCardRecord & { drawerMessageCount?: number }>();

  if (!before) {
    return null;
  }

  // If the user struggled (lots of drawer messages), shorten the snooze window
  if (before.drawerMessageCount && before.drawerMessageCount > 3) {
    const shorterDueAt = new Date(Date.now() + Math.floor(SMART_RECALL_SNOOZE_MS / 2));
    await SmartRecallCard.updateOne(
      { _id: input.cardId },
      { $set: { dueAt: shorterDueAt } }
    );
  }

  return buildSmartRecallSummaryLightweight(
    input.userId,
    getResolvedTimezone(input.timezone)
  );
}

export async function markSmartRecallTutorialSeen(userId: string) {
  await connectToDatabase();

  await User.findByIdAndUpdate(userId, {
    $set: {
      "smartRecall.tutorialSeenAt": new Date(),
    },
  });
}
