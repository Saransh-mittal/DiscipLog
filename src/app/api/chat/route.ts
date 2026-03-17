import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { streamText, smoothStream } from "ai";
import { openai } from "@ai-sdk/openai";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";
import Commitment from "@/models/Commitment";
import { formatLocalDate, getWeekStart } from "@/lib/logs";

interface LogEntry {
  date: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string;
  loggedAt?: string;
  createdAt: string;
}

interface UserCategory {
  name: string;
  dailyTargetHours: number;
  weeklyMinTarget: number;
  weeklyMaxTarget: number;
}

async function buildSystemPrompt(
  logs: LogEntry[],
  timezone: string,
  userId: string
): Promise<string> {
  // Fetch user's categories & commitments from DB
  await connectToDatabase();
  const user = await User.findById(userId).lean();
  const weekStartDate = getWeekStart();
  const weekStartStr = formatLocalDate(weekStartDate);
  const commitments = await Commitment.find({
    userId,
    weekStart: weekStartStr,
  }).lean();

  // Build dynamic targets from user categories
  const categories: UserCategory[] = user?.categories || [];
  const targets = categories.length > 0
    ? `Weekly Targets:\n${categories
        .map(
          (c: UserCategory) =>
            `- ${c.name}: ${c.weeklyMinTarget}–${c.weeklyMaxTarget} hrs/week (daily target: ${c.dailyTargetHours}h)`
        )
        .join("\n")}`
    : "No categories configured yet.";

  // Compute weekly category breakdown
  const now = new Date();
  const weeklyHours: Record<string, number> = {};
  const todayStr = now.toISOString().split("T")[0];
  let todayTotal = 0;

  const recentLogs: string[] = [];

  logs.forEach((log) => {
    if (log.date >= weekStartStr) {
      weeklyHours[log.category] = (weeklyHours[log.category] || 0) + log.hours;
    }
    if (log.date === todayStr) {
      todayTotal += log.hours;
    }
  });

  // Last 10 logs as context
  const recent = logs.slice(0, 10);
  recent.forEach((log) => {
    let time = "unknown time";
    const eventTimestamp = log.loggedAt || log.createdAt;
    if (eventTimestamp) {
      try {
        time = new Date(eventTimestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: timezone,
        });
      } catch {
        time = new Date(eventTimestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }
    }
    recentLogs.push(
      `[${log.date} at ${time}] ${log.category} — ${log.hours}h\nSummary: ${log.aiSummary || "N/A"}\n`
    );
  });

  const weekSummary = Object.entries(weeklyHours)
    .map(([cat, hrs]) => `  ${cat}: ${hrs}h`)
    .join("\n");

  // Commitments context
  const commitmentLines = commitments.length > 0
    ? commitments
        .map(
          (c: any) =>
            `- "${c.text}" — Status: ${c.status}${c.missedReason ? ` (reason: ${c.missedReason})` : ""}`
        )
        .join("\n")
    : "No commitments this week.";

  return `You are DiscipLog AI — a direct, no-nonsense productivity coach for a software engineer.
You have full context on their logged work sessions.

${targets}

This Week's Progress (since ${weekStartStr}):
${weekSummary || "  No logs yet this week."}

Today's total: ${todayTotal}h

Weekly Commitments:
${commitmentLines}

Recent Log Entries:
${recentLogs.length > 0 ? recentLogs.join("\n") : "No entries yet."}

Current date/time: ${now.toISOString()}
Day of week: ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()]}

Rules:
- Be concise, direct, and actionable. Avoid generic fluff.
- Reference their actual logged data (hours, categories, and summaries) when giving advice.
- **Tone:** You are a strict but fair coach. Balance "tough love" with genuine encouragement.
- **Quality over Quantity (CRITICAL):** You MUST read the 'Summary' for their logs. If a log is very short (e.g., 0.2h) but the summary implies highly dense, technical, or complex work (like architectural design, complex logic, or deep research), you MUST acknowledge and praise the extraordinary depth and quality of that sprint BEFORE mentioning any time deficit.
- If they're behind on a category, call it out specifically with the gap, but offer a realistic next step.
- Give time-boxed suggestions when relevant (e.g., "Spend the next 2 hours on Interview Prep to close the gap").
- When asked about patterns, analyze their logging timestamps and category distribution.
- Reference their weekly commitments when relevant — if they committed to ship something, ask about progress or acknowledge completion.`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { messages, logs, timezone } = await req.json();

    const userTimezone = timezone || "Asia/Kolkata";
    const systemPrompt = await buildSystemPrompt(
      logs || [],
      userTimezone,
      userId
    );

    const coreMessages = messages.map((m: any) => ({
      role: m.role,
      content:
        m.content || m.parts?.map((p: any) => p.text || "").join("") || "",
    }));

    const result = streamText({
      model: openai("gpt-5-nano"),
      messages: coreMessages,
      system: systemPrompt,
      experimental_transform: smoothStream(),
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("[CHAT_ERROR]", error);

    try {
      const connectToDatabase = require("@/lib/mongoose").default;
      const ErrorLog = require("@/models/ErrorLog").default;
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || "unknown",
        context: "Server-ChatAPI",
        errorMessage: error?.message || "Unknown Chat error",
        stackTrace:
          process.env.NODE_ENV === "development"
            ? error?.stack
            : "Hidden in production",
      });
    } catch (e) {}

    if (
      error?.message?.includes("insufficient_quota") ||
      error?.code === "insufficient_quota" ||
      error?.type === "insufficient_quota"
    ) {
      return new NextResponse(
        "Service unavailable: OpenAI quota exceeded. Please check billing details.",
        { status: 503 }
      );
    }

    if (process.env.NODE_ENV === "development") {
      return new NextResponse(
        error.message || error.stack || "Internal Error",
        { status: 500 }
      );
    }
    return new NextResponse("An anomaly occurred during chat.", {
      status: 500,
    });
  }
}
