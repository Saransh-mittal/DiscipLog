import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { streamText, smoothStream } from "ai";
import { openai } from "@ai-sdk/openai";

interface LogEntry {
  date: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string;
  loggedAt?: string;
  createdAt: string;
}

function buildSystemPrompt(logs: LogEntry[], timezone: string): string {
  // Weekly targets
  const targets = `Weekly Targets:
- Interview Prep: 15–20 hrs/week
- Building: 10–12 hrs/week
- Learning: 6–7 hrs/week
- Shipping: No strict target (bonus/cherry on top)`;

  // Compute weekly category breakdown
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split("T")[0];

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

  // Last 10 logs as context (include exact time in user's timezone)
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

  return `You are DiscipLog AI — a direct, no-nonsense productivity coach for a software engineer.
You have full context on their logged work sessions.

${targets}

This Week's Progress (since ${weekStartStr}):
${weekSummary || "  No logs yet this week."}

Today's total: ${todayTotal}h

Recent Log Entries:
${recentLogs.length > 0 ? recentLogs.join("\n") : "No entries yet."}

Current date/time: ${now.toISOString()}
Day of week: ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()]}

Rules:
- Be concise, direct, and actionable. Avoid generic fluff.
- Reference their actual logged data (hours, categories, and summaries) when giving advice.
- **Tone:** You are a strict but fair coach. Balance "tough love" with genuine encouragement.
- **Quality over Quantity (CRITICAL):** You MUST read the 'Summary' for their logs. If a log is very short (e.g., 0.2h) but the summary implies highly dense, technical, or complex work (like architectural design, complex logic, or deep research), you MUST acknowledge and praise the extraordinary depth and quality of that sprint BEFORE mentioning any time deficit. It IS extraordinary to write complex technical specs in x minutes.
- If they're behind on a category, call it out specifically with the gap, but offer a realistic next step.
- Give time-boxed suggestions when relevant (e.g., "Spend the next 2 hours on Interview Prep to close the gap").
- When asked about patterns, analyze their logging timestamps and category distribution.`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { messages, logs, timezone } = await req.json();

    const userTimezone = timezone || "Asia/Kolkata";
    const systemPrompt = buildSystemPrompt(logs || [], userTimezone);

    // Map UI messages from useChat to ModelMessages that streamText expects
    const coreMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content || m.parts?.map((p: any) => p.text || "").join("") || "",
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
    } catch (e) { }

    if (error?.message?.includes("insufficient_quota") || error?.code === "insufficient_quota" || error?.type === "insufficient_quota") {
      return new NextResponse("Service unavailable: OpenAI quota exceeded. Please check billing details.", { status: 503 });
    }

    if (process.env.NODE_ENV === "development") {
      return new NextResponse(error.message || error.stack || "Internal Error", { status: 500 });
    }
    return new NextResponse("An anomaly occurred during chat.", { status: 500 });
  }
}
