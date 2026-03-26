import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { authOptions } from "../auth/[...nextauth]/route";
import { getPersonaOption, getPersonaPromptInstructions } from "@/lib/ai-profile";
import {
  buildCoachQuerySignals,
  getBaselineCoachContext,
  getCoachStats,
  searchHistoricalLogs,
  type BaselineCoachContext,
  type CoachContextLog,
  type CoachStatsResult,
  type HistoricalSearchResult,
} from "@/lib/coach-context";
import { getZonedDateContext, type UserCategory } from "@/lib/logs";
import { scheduleImplicitMemoryRefreshFromChat } from "@/lib/implicit-memory";
import connectToDatabase from "@/lib/mongoose";
import ErrorLog from "@/models/ErrorLog";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function getMessageText(message: UIMessage): string {
  return (
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join(" ")
      .trim() || ""
  );
}

function formatHours(hours: number): string {
  return `${Math.round(hours * 100) / 100}h`;
}

function truncateText(value: string, maxChars: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function formatLogEntries(logs: CoachContextLog[], timezone: string): string {
  if (logs.length === 0) {
    return "No recent entries available.";
  }

  return logs
    .map((log) => {
      const timestamp = log.loggedAt || log.createdAt;
      const localTime = timestamp
        ? new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(timestamp))
        : "unknown time";
      const summary = truncateText(
        log.aiSummary || log.rawTranscript || "No summary available.",
        320
      );

      return `[${log.date} at ${localTime}] ${log.category} — ${formatHours(
        log.hours
      )}\nSummary: ${summary}`;
    })
    .join("\n\n");
}

function formatCategoryTargets(categories: UserCategory[]): string {
  if (categories.length === 0) {
    return "No categories configured yet.";
  }

  return categories
    .map(
      (category) =>
        `- ${category.name}: ${category.weeklyMinTarget}–${category.weeklyMaxTarget} hrs/week (daily target: ${category.dailyTargetHours}h)`
    )
    .join("\n");
}

function formatCategoryStats(
  stats: Array<{
    category: string;
    totalLogs: number;
    totalHours: number;
    firstLogDate?: string;
    lastLogDate?: string;
  }>,
  emptyState: string
): string {
  if (stats.length === 0) {
    return emptyState;
  }

  return stats
    .map((stat) => {
      const range =
        stat.firstLogDate && stat.lastLogDate
          ? ` (${stat.firstLogDate} → ${stat.lastLogDate})`
          : "";
      return `- ${stat.category}: ${formatHours(stat.totalHours)}, ${stat.totalLogs} logs${range}`;
    })
    .join("\n");
}

function formatCommitments(
  commitments: BaselineCoachContext["weeklyCommitments"]
): string {
  if (commitments.length === 0) {
    return "No commitments this week.";
  }

  return commitments
    .map(
      (commitment) =>
        `- "${commitment.text}" — Status: ${commitment.status}${commitment.missedReason ? ` (reason: ${commitment.missedReason})` : ""
        }`
    )
    .join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function buildToolOutputPreview(output: unknown): Record<string, unknown> | unknown {
  if (!isRecord(output)) {
    return output;
  }

  if (typeof output.resultSummary === "string") {
    return {
      resultSummary: output.resultSummary,
      retrievalMode:
        typeof output.retrievalMode === "string" ? output.retrievalMode : undefined,
      resolvedCategories:
        Array.isArray(output.resolvedCategories) ? output.resolvedCategories : [],
      dateCoverage: isRecord(output.dateCoverage) ? output.dateCoverage : undefined,
    };
  }

  if (Array.isArray(output.matches)) {
    return {
      retrievalMode:
        typeof output.retrievalMode === "string" ? output.retrievalMode : undefined,
      matchCount: output.matches.length,
      resolvedCategories:
        Array.isArray(output.resolvedCategories) ? output.resolvedCategories : [],
    };
  }

  if (isRecord(output.overview)) {
    return {
      label: typeof output.label === "string" ? output.label : undefined,
      matchedLogs:
        typeof output.overview.matchedLogs === "number"
          ? output.overview.matchedLogs
          : undefined,
      matchedHours:
        typeof output.overview.matchedHours === "number"
          ? output.overview.matchedHours
          : undefined,
      resolvedCategories:
        Array.isArray(output.resolvedCategories) ? output.resolvedCategories : [],
    };
  }

  return output;
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function serializeHistoricalToolResult(
  result: HistoricalSearchResult
): Record<string, unknown> {
  const resultSummaryParts = [
    `Found ${result.matches.length} matching log${result.matches.length === 1 ? "" : "s"}`,
  ];

  if (result.dateCoverage.firstDate && result.dateCoverage.lastDate) {
    resultSummaryParts.push(
      `from ${result.dateCoverage.firstDate} to ${result.dateCoverage.lastDate}`
    );
  }

  if (result.resolvedCategories.length > 0) {
    resultSummaryParts.push(`across ${result.resolvedCategories.join(", ")}`);
  }

  return {
    query: result.query,
    retrievalMode: result.mode,
    resolvedCategories: result.resolvedCategories,
    advisoryLabels: result.advisoryLabels,
    searchPhrases: result.searchPhrases,
    topicTerms: result.topicTerms,
    intentTags: result.intentTags,
    dateCoverage: result.dateCoverage,
    resultSummary: resultSummaryParts.join(" "),
    matches: result.matches.map((log) => ({
      id: log.id,
      date: log.date,
      category: log.category,
      hours: log.hours,
      score:
        typeof log.score === "number"
          ? Number(log.score.toFixed(3))
          : undefined,
      summaryPreview: truncateText(log.aiSummary || log.rawTranscript, 160),
    })),
  };
}

function serializeStatsToolResult(result: CoachStatsResult): Record<string, unknown> {
  const resultSummaryParts = [];

  if (typeof result.overview.matchedLogs === "number") {
    resultSummaryParts.push(
      `${result.overview.matchedLogs} matching log${result.overview.matchedLogs === 1 ? "" : "s"
      }`
    );
  }

  if (typeof result.overview.matchedHours === "number") {
    resultSummaryParts.push(`${result.overview.matchedHours}h`);
  }

  if (result.dateCoverage.firstDate && result.dateCoverage.lastDate) {
    resultSummaryParts.push(
      `from ${result.dateCoverage.firstDate} to ${result.dateCoverage.lastDate}`
    );
  }

  return {
    label: result.label,
    query: result.query,
    resolvedCategories: result.resolvedCategories,
    advisoryLabels: result.advisoryLabels,
    searchPhrases: result.searchPhrases,
    topicTerms: result.topicTerms,
    intentTags: result.intentTags,
    matchStrategy: result.matchStrategy,
    range: result.range,
    dateCoverage: result.dateCoverage,
    overview: result.overview,
    resultSummary: resultSummaryParts.join(", "),
    byCategory: result.byCategory.map((item) => ({
      category: item.category,
      totalLogs: item.totalLogs,
      totalHours: item.totalHours,
      firstLogDate: item.firstLogDate,
      lastLogDate: item.lastLogDate,
    })),
    recentExamples: result.recentExamples.map((log) => ({
      id: log.id,
      date: log.date,
      category: log.category,
      hours: log.hours,
      summaryPreview: truncateText(log.aiSummary || log.rawTranscript, 160),
    })),
  };
}

interface BuildSystemPromptResult {
  systemPrompt: string;
  latestUserText: string;
  baselineContext: BaselineCoachContext;
  signals: ReturnType<typeof buildCoachQuerySignals>;
}

async function buildSystemPrompt(input: {
  timezone: string;
  userId: string;
  messages: UIMessage[];
}): Promise<BuildSystemPromptResult> {
  const now = new Date();
  const localNow = getZonedDateContext(now, input.timezone);
  const latestUserMessage =
    [...input.messages].reverse().find((message) => message.role === "user") ??
    null;
  const latestUserText = latestUserMessage ? getMessageText(latestUserMessage) : "";
  const baselineContext = await getBaselineCoachContext({
    userId: input.userId,
    timezone: input.timezone,
  });
  const signals = buildCoachQuerySignals(
    latestUserText,
    baselineContext.userCategories
  );
  const personaOption = getPersonaOption(baselineContext.aiProfile.persona);
  const weekSummary = formatCategoryStats(
    baselineContext.structuredStats.weeklyByCategory,
    "No logs yet this week."
  );
  const lifetimeSummary = formatCategoryStats(
    baselineContext.structuredStats.byCategory,
    "No lifetime category data yet."
  );
  const currentTimeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const weeklyDebriefText = baselineContext.latestWeeklyDebrief
    ? `Title: ${baselineContext.latestWeeklyDebrief.weekTitle}\nNote: ${baselineContext.latestWeeklyDebrief.coachNote}\nChallenge: ${baselineContext.latestWeeklyDebrief.challengeForNextWeek}`
    : "No recent debrief available.";
  const toolRecommendation =
    signals.wantsHistorical || signals.wantsStructuredStats
      ? "should-use-tools"
      : "baseline-preferred";
  const toolGuidance =
    toolRecommendation === "should-use-tools"
      ? `The latest user request is history or stats oriented.
You MUST call at least one relevant tool before answering.
Call searchHistoricalLogs for journey/topic/struggle evidence and call getCoachStats for counts, date ranges, or comparisons when useful.
Do not answer these deeper questions from baseline context alone unless a tool fails.
For journey, progress, struggle, or "what have I learned" questions, stay grounded in actual history and include the latest relevant evidence.`
      : `The latest user request is tactical or recent-context oriented.
Prefer the recent context and baseline stats you already have.
Use tools only if the user explicitly asks for deeper history or exact counts that baseline context cannot prove.`;
  const rules = [
    "Be concise, direct, and actionable. Avoid generic fluff.",
    "Bite-Sized Sprints (CRITICAL): DiscipLog is built for sprinting. Do not suggest marathon blocks. Favor focused 25–40 minute sprints or 5–20 minute quick wins.",
    "Use the baseline recent context first for tactical questions about today, tonight, or the next step.",
    "For journey, topic, struggle, count, and timeline questions, use tools before answering.",
    "Reference retrieved evidence when giving advice. Prefer the user's real logs over generic coaching.",
    "When the stats tool only proves matching-log counts, say 'based on matching logs' instead of overstating certainty.",
    "Retrospective answers must stay analysis-first. Do not invent a multi-week roadmap or future study plan unless the user explicitly asks for a plan.",
    "For retrospective or learning-summary questions, do not add next steps, action items, or a plan unless the user explicitly asks.",
    "When making historical claims, include 2-4 markdown bullets that start with `- Evidence:` and use full YYYY-MM-DD dates. Never use MM/DD shorthand dates.",
    "For questions that include 'so far', include the latest relevant evidence date if the tools provide it.",
    "Treat implicit memory as tentative guidance. If recent logs or this chat conflict with it, trust the newer evidence.",
    "If they're behind on a category, call it out specifically with the gap, but offer a realistic next step.",
    "Match the selected persona consistently without sounding generic or theatrical.",
    "Use the user's core why and custom instructions when they matter.",
    "If the local time today is 20:00 or later, bias toward a shutdown move, recap, or tomorrow setup unless the user explicitly asks for a long block tonight.",
    "If a tool fails, acknowledge the limit and answer from the baseline context you do have. Do not hallucinate missing history.",
    "Format your responses using markdown: use **bold** for emphasis, bullet lists (- item) for action items and key points, and headers (##) for sections when the response has multiple topics. Keep formatting light for short answers — a single sentence needs no markdown.",
  ];

  const systemPrompt = `You are DiscipLog AI — a personalized productivity coach for a software engineer.
You already have baseline context for recent work, weekly targets, commitments, and stable memory.
Use tools only when the question needs deeper history or exact counts/timelines.

AI Coach Persona:
- Selected persona: ${personaOption.label}
- Style contract: ${getPersonaPromptInstructions(baselineContext.aiProfile.persona)}

User Motivation Context:
- Core why: ${baselineContext.aiProfile.coreWhy || "Not provided yet."}
- Custom instructions: ${baselineContext.aiProfile.customInstructions || "None provided."}

Internal Coaching Memory:
${baselineContext.memoryContext || "No implicit coaching memory yet."}

Weekly Targets:
${formatCategoryTargets(baselineContext.userCategories)}

Baseline Stats:
- Lifetime totals: ${baselineContext.structuredStats.overview.totalLogs} logs, ${formatHours(
    baselineContext.structuredStats.overview.totalHours
  )}, ${baselineContext.structuredStats.overview.activeDays} active days
- First log date: ${baselineContext.structuredStats.overview.firstLogDate || "N/A"}
- Last log date: ${baselineContext.structuredStats.overview.lastLogDate || "N/A"}
- Today's total: ${formatHours(baselineContext.structuredStats.todayTotalHours)}

This Week's Progress (since ${baselineContext.weekStartDateKey}):
${weekSummary}

Latest Weekly Debrief:
${weeklyDebriefText}

Lifetime Category Journey Snapshot:
${lifetimeSummary}

Weekly Commitments:
${formatCommitments(baselineContext.weeklyCommitments)}

Recent Context:
${formatLogEntries(baselineContext.recentLogs, input.timezone)}

Available Tools:
- searchHistoricalLogs: Search older logs semantically when the user asks about their journey, topic history, struggles, breakthroughs, or lessons learned.
- getCoachStats: Get deterministic matching-log counts, date ranges, and category totals for questions like "how many", "when did I start", or "compare X vs Y".

Tool Guidance:
${toolGuidance}

User local time context:
- Timezone: ${input.timezone}
- Local date/time: ${currentTimeLabel}
- Local date key: ${localNow.dateKey}
- Local time (24h): ${localNow.timeKey}
- Local hour: ${localNow.hour}
- Day of week: ${localNow.weekday}

Rules:
${rules.map((rule) => `- ${rule}`).join("\n")}`;


  return {
    systemPrompt,
    latestUserText,
    baselineContext,
    signals,
  };
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { messages = [], timezone } = await req.json();
    const userTimezone = timezone || "Asia/Kolkata";
    const typedMessages = messages as UIMessage[];
    const promptContext = await buildSystemPrompt({
      timezone: userTimezone,
      userId,
      messages: typedMessages,
    });
    const modelMessages = await convertToModelMessages(typedMessages);
    const recentLogIds = promptContext.baselineContext.recentLogs.map((log) => log.id);
    const toolNamesUsed = new Set<string>();
    const toolNamesErrored = new Set<string>();

    const result = streamText({
      model: openai("gpt-5-nano"),
      system: promptContext.systemPrompt,
      messages: modelMessages,
      toolChoice: "auto",
      stopWhen: stepCountIs(4),
      tools: {
        searchHistoricalLogs: tool({
          description:
            "Search older logs semantically for journeys, topic coverage, struggles, breakthroughs, and lessons learned. Returns compact log summaries with scores.",
          inputSchema: z.object({
            query: z.string().min(2).max(240),
            categories: z.array(z.string().min(1)).max(4).optional(),
            limit: z.number().int().min(1).max(8).optional(),
          }),
          execute: async ({ query, categories, limit }) => {
            const searchResult = await searchHistoricalLogs({
              userId,
              query,
              categories,
              limit,
              excludeLogIds: recentLogIds,
              availableCategories: promptContext.baselineContext.userCategories,
            });

            return serializeHistoricalToolResult(searchResult);
          },
        }),
        getCoachStats: tool({
          description:
            "Get deterministic matching-log stats, date ranges, category totals, and a few recent examples. Use for counts, comparisons, and timelines.",
          inputSchema: z.object({
            query: z.string().min(1).max(240).optional(),
            categories: z.array(z.string().min(1)).max(4).optional(),
            range: z
              .object({
                startDate: z.string().regex(DATE_KEY_RE).optional(),
                endDate: z.string().regex(DATE_KEY_RE).optional(),
              })
              .optional(),
            includeExamples: z.boolean().optional(),
          }),
          execute: async ({ query, categories, range, includeExamples }) => {
            const statsResult = await getCoachStats({
              userId,
              query,
              categories,
              range,
              includeExamples,
              availableCategories: promptContext.baselineContext.userCategories,
            });

            return serializeStatsToolResult(statsResult);
          },
        }),
      },
      experimental_transform: smoothStream(),
      experimental_onToolCallStart: ({ toolCall }) => {
        toolNamesUsed.add(toolCall.toolName);
      },
      experimental_onToolCallFinish: ({ success, durationMs, toolCall, output, error }) => {
        if (!success) {
          toolNamesErrored.add(toolCall.toolName);
        }
      },
      onFinish: ({ finishReason, steps }) => {
        scheduleImplicitMemoryRefreshFromChat(userId, typedMessages);

        const toolsFromSteps = uniqueStrings(
          steps.flatMap((step) => step.toolCalls.map((toolCall) => toolCall.toolName))
        );
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: typedMessages,
    });
  } catch (error: unknown) {
    console.error("[CHAT_ERROR]", error);

    try {
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || "unknown",
        context: "Server-ChatAPI",
        errorMessage: error instanceof Error ? error.message : "Unknown Chat error",
        stackTrace:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.stack
              : "Unknown stack"
            : "Hidden in production",
      });
    } catch { }

    if (error instanceof Error && error.message.includes("insufficient_quota")) {
      return new NextResponse(
        "Service unavailable: OpenAI quota exceeded. Please check billing details.",
        { status: 503 }
      );
    }

    if (process.env.NODE_ENV === "development") {
      return new NextResponse(
        error instanceof Error
          ? error.message || error.stack || "Internal Error"
          : "Internal Error",
        { status: 500 }
      );
    }

    return new NextResponse("An anomaly occurred during chat.", {
      status: 500,
    });
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
