import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import connectToDatabase from "@/lib/mongoose";
import LogEntry from "@/models/LogEntry";
import User from "@/models/User";
import ErrorLog from "@/models/ErrorLog";
import {
  getPersonaOption,
  getStoredAIProfile,
  sanitizeProfileText,
} from "@/lib/ai-profile";

const FIRST_MEMORY_MIN_LOGS = 3;
const NEW_LOG_THRESHOLD = 3;
const LOOKBACK_DAYS = 14;
const MAX_LOGS_IN_PROMPT = 24;
const MAX_CHAT_TURNS_IN_PROMPT = 6;
const CHAT_MIN_USER_MESSAGES = 3;
const CHAT_MIN_TOTAL_CHARS = 220;
export const LOG_COOLDOWN_MS = 1 * 60 * 60 * 1000;
const CHAT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 72 * 60 * 60 * 1000;

type TriggerSource = "log" | "chat";

interface ChatSessionMessage {
  role?: string;
  content?: string;
  parts?: Array<{ type?: string; text?: string }>;
}

interface QueueEvaluationInput {
  userId: string;
  source: TriggerSource;
  messages?: unknown[];
}

interface EvaluationDecision {
  action: "no_update" | "refresh_memory";
  memory: string;
}

function getMessageText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  const record = message as ChatSessionMessage;

  if (typeof record.content === "string") {
    return record.content.trim();
  }

  if (!Array.isArray(record.parts)) {
    return "";
  }

  return record.parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getMeaningfulChatSession(messages: unknown[] | undefined): string[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  const userMessages = messages
    .filter(
      (message) =>
        message &&
        typeof message === "object" &&
        (message as ChatSessionMessage).role === "user"
    )
    .map(getMessageText)
    .filter(Boolean);

  const recentMessages = userMessages.slice(-MAX_CHAT_TURNS_IN_PROMPT);
  const totalChars = recentMessages.reduce(
    (sum, message) => sum + message.length,
    0
  );

  if (
    recentMessages.length < CHAT_MIN_USER_MESSAGES ||
    totalChars < CHAT_MIN_TOTAL_CHARS
  ) {
    return [];
  }

  return recentMessages;
}

function getLatestDate(dates: Array<Date | null>): Date | null {
  return dates.reduce<Date | null>((latest, current) => {
    if (!current) {
      return latest;
    }

    if (!latest || current.getTime() > latest.getTime()) {
      return current;
    }

    return latest;
  }, null);
}

function getLastReviewAt(profile: ReturnType<typeof getStoredAIProfile>): Date | null {
  return getLatestDate([
    profile.implicitMemoryUpdatedAt,
    profile.implicitMemoryLastEvaluatedLogAt,
    profile.implicitMemoryLastEvaluatedChatAt,
  ]);
}

function isWithinWindow(date: Date | null, durationMs: number): boolean {
  if (!date) {
    return false;
  }

  return Date.now() - date.getTime() < durationMs;
}

function cleanJsonResponse(text: string): string {
  return text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
}

function formatRecentLogs(
  logs: Array<{
    date?: string;
    category?: string;
    hours?: number;
    aiSummary?: string;
    rawTranscript?: string;
    createdAt?: Date | string;
  }>
): string {
  if (logs.length === 0) {
    return "No recent logs available.";
  }

  return logs
    .map((log) => {
      const transcript =
        typeof log.rawTranscript === "string"
          ? log.rawTranscript.trim().slice(0, 180)
          : "";
      const summary =
        typeof log.aiSummary === "string" && log.aiSummary.trim()
          ? log.aiSummary.trim()
          : transcript || "No summary";

      return `- ${log.date || "Unknown date"} | ${log.category || "Unknown category"} | ${typeof log.hours === "number" ? `${log.hours}h` : "Unknown duration"
        }\n  Summary: ${summary}`;
    })
    .join("\n");
}

async function decideImplicitMemoryUpdate(input: {
  existingMemory: string;
  persona: string;
  coreWhy: string;
  customInstructions: string;
  logsSummary: string;
  chatSummary: string;
}): Promise<EvaluationDecision> {
  const result = await generateText({
    model: openai("gpt-5-nano"),
    system: `You maintain a compact internal coaching memory for a productivity app.

Output ONLY valid JSON with one of these shapes:
{"action":"no_update","memory":""}
{"action":"refresh_memory","memory":"2-4 short sentences"}

Rules:
- Update memory only if the new evidence reveals a stable, coaching-relevant pattern that would improve future coaching.
- Prefer no_update when the evidence is routine, tactical, or too thin.
- Memory must be concise, specific, non-clinical, and grounded in observed behavior.
- Focus on patterns like consistency, timing, follow-through, pressure response, avoidance, and recovery.
- Avoid medical, diagnostic, or dramatic language.
- Do not mention that this is an internal note.`,
    prompt: `Persona: ${input.persona}
Core why: ${input.coreWhy || "Not provided"}
Custom instructions: ${input.customInstructions || "None"}

Existing implicit memory:
${input.existingMemory || "None yet."}

Recent logs:
${input.logsSummary}

Recent meaningful chat session:
${input.chatSummary || "None"}

Decide whether the implicit memory should change materially. Return JSON only.`,
  });

  try {
    const parsed = JSON.parse(cleanJsonResponse(result.text)) as Partial<
      EvaluationDecision
    >;
    const memory = sanitizeProfileText(
      parsed.memory
    );

    return {
      action:
        parsed.action === "refresh_memory" && memory
          ? "refresh_memory"
          : "no_update",
      memory,
    };
  } catch {
    return { action: "no_update", memory: "" };
  }
}

async function clearPendingFlag(userId: string) {
  await User.findByIdAndUpdate(userId, {
    $set: { "aiProfile.implicitMemoryPending": false },
  });
}

async function runImplicitMemoryEvaluation({
  userId,
  source,
  messages,
}: QueueEvaluationInput): Promise<void> {
  try {
    await connectToDatabase();

    const user = await User.findById(userId).lean();
    if (!user) {
      return;
    }

    const profile = getStoredAIProfile(user.aiProfile);
    if (profile.implicitMemoryPending) {
      return;
    }

    const totalLogs = await LogEntry.countDocuments({ userId });
    const newLogsSinceLastEvaluation = profile.implicitMemoryLastEvaluatedLogAt
      ? await LogEntry.countDocuments({
        userId,
        createdAt: { $gt: profile.implicitMemoryLastEvaluatedLogAt },
      })
      : totalLogs;

    const reviewAnchor = getLastReviewAt(profile);
    const cooldownMs = source === "log" ? LOG_COOLDOWN_MS : CHAT_COOLDOWN_MS;
    const withinCooldown = isWithinWindow(reviewAnchor, cooldownMs);
    const staleEnough = !reviewAnchor || !isWithinWindow(reviewAnchor, STALE_MS);
    const meaningfulChatTurns =
      source === "chat" ? getMeaningfulChatSession(messages) : [];

    const shouldEvaluateFromLogs =
      (!profile.implicitMemory && totalLogs >= FIRST_MEMORY_MIN_LOGS) ||
      newLogsSinceLastEvaluation >= NEW_LOG_THRESHOLD ||
      (staleEnough && newLogsSinceLastEvaluation >= 1);

    const shouldEvaluateFromChat =
      meaningfulChatTurns.length > 0 &&
      totalLogs >= 1 &&
      (!profile.implicitMemory || staleEnough);

    const eligible =
      !withinCooldown &&
      (source === "log" ? shouldEvaluateFromLogs : shouldEvaluateFromChat);

    if (!eligible) {
      return;
    }

    const claimedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        "aiProfile.implicitMemoryPending": { $ne: true },
      },
      {
        $set: { "aiProfile.implicitMemoryPending": true },
      },
      { returnDocument: "after" }
    ).lean();

    if (!claimedUser) {
      return;
    }

    const profileAfterClaim = getStoredAIProfile(claimedUser.aiProfile);
    const evaluationStartedAt = new Date();
    const logCutoff = new Date(
      evaluationStartedAt.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );

    const recentLogs = await LogEntry.find({
      userId,
      createdAt: { $gte: logCutoff },
    })
      .sort({ createdAt: -1 })
      .limit(MAX_LOGS_IN_PROMPT)
      .lean();

    const latestLogCreatedAt =
      recentLogs.length > 0 && recentLogs[0].createdAt instanceof Date
        ? recentLogs[0].createdAt
        : null;

    const persona = getPersonaOption(profileAfterClaim.persona);
    const decision = await decideImplicitMemoryUpdate({
      existingMemory: profileAfterClaim.implicitMemory,
      persona: persona.label,
      coreWhy: profileAfterClaim.coreWhy,
      customInstructions: profileAfterClaim.customInstructions,
      logsSummary: formatRecentLogs(recentLogs),
      chatSummary:
        meaningfulChatTurns.length > 0
          ? meaningfulChatTurns.map((turn) => `- ${turn}`).join("\n")
          : "",
    });

    const update: Record<string, unknown> = {
      "aiProfile.implicitMemoryPending": false,
    };

    if (latestLogCreatedAt) {
      update["aiProfile.implicitMemoryLastEvaluatedLogAt"] = latestLogCreatedAt;
    }

    if (source === "chat") {
      update["aiProfile.implicitMemoryLastEvaluatedChatAt"] =
        evaluationStartedAt;
    }

    const shouldWriteMemory =
      decision.action === "refresh_memory" &&
      decision.memory &&
      decision.memory !== profileAfterClaim.implicitMemory;

    if (shouldWriteMemory) {
      update["aiProfile.implicitMemory"] = decision.memory;
      update["aiProfile.implicitMemoryUpdatedAt"] = evaluationStartedAt;
    }

    await User.findByIdAndUpdate(userId, { $set: update });
  } catch (error) {
    console.error("[IMPLICIT_MEMORY_EVALUATION_ERROR]", error);

    try {
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || "unknown",
        context: `ImplicitMemory-Evaluation-${source}`,
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      await clearPendingFlag(userId);
    } catch { }
  }
}

function scheduleEvaluation(input: QueueEvaluationInput) {
  queueMicrotask(() => {
    void runImplicitMemoryEvaluation(input);
  });
}

export function scheduleImplicitMemoryRefreshFromLog(userId: string) {
  scheduleEvaluation({ userId, source: "log" });
}

export function scheduleImplicitMemoryRefreshFromChat(
  userId: string,
  messages: unknown[] | undefined
) {
  scheduleEvaluation({ userId, source: "chat", messages });
}
