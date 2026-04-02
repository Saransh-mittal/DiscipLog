import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import ErrorLog from "@/models/ErrorLog";
import LogEntry from "@/models/LogEntry";
import {
  deriveLogDate,
  isValidLogSource,
  isValidSprintCompletionStatus,
  isValidTimezone,
  parseLogInstant,
} from "@/lib/logs";
import {
  scheduleCoachEmbeddingBackfill,
  scheduleCoachEmbeddingRefreshForLog,
} from "@/lib/coach-embeddings";
import { scheduleImplicitMemoryRefreshFromLog } from "@/lib/implicit-memory";
import {
  getPendingSmartRecallEligibility,
  scheduleSmartRecallEligibilityBackfill,
  scheduleSmartRecallEligibilityRefresh,
} from "@/lib/smart-recall";
import { scheduleUsagePatternRecalc } from "@/lib/usage-patterns";

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();
    const {
      hours,
      category,
      rawTranscript,
      summary,
      loggedAt,
      timezone,
      source = "manual",
      plannedMinutes,
      actualMinutes,
      startedAt,
      completedAt,
      completionStatus,
    } = body;
    const resolvedTimezone = isValidTimezone(timezone) ? timezone : "UTC";

    if (
      typeof rawTranscript !== "string" ||
      !rawTranscript.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof source !== "string" ||
      !isValidLogSource(source)
    ) {
      return new NextResponse("Invalid log payload", { status: 400 });
    }

    await connectToDatabase();

    const payload: Record<string, unknown> = {
      userId,
      category,
      rawTranscript: rawTranscript.trim(),
      aiSummary: typeof summary === "string" ? summary.trim() : undefined,
      source,
      smartRecallEligibility: getPendingSmartRecallEligibility(),
    };

    let logInstant: Date;

    if (source === "sprint") {
      const parsedPlannedMinutes = parsePositiveNumber(plannedMinutes);
      const parsedActualMinutes = parsePositiveNumber(actualMinutes);
      const parsedStartedAt = parseLogInstant(startedAt);
      const parsedCompletedAt = parseLogInstant(completedAt);
      const normalizedStatus =
        typeof completionStatus === "string" &&
        isValidSprintCompletionStatus(completionStatus)
          ? completionStatus
          : parsedActualMinutes !== null &&
              parsedPlannedMinutes !== null &&
              parsedActualMinutes >= parsedPlannedMinutes
            ? "completed"
            : "finished_early";

      if (
        parsedPlannedMinutes === null ||
        parsedActualMinutes === null ||
        parsedStartedAt === null ||
        parsedCompletedAt === null
      ) {
        return new NextResponse("Invalid sprint payload", { status: 400 });
      }

      logInstant = parsedCompletedAt;
      payload.hours = Number((parsedActualMinutes / 60).toFixed(2));
      payload.plannedMinutes = Math.round(parsedPlannedMinutes);
      payload.actualMinutes = Math.round(parsedActualMinutes);
      payload.startedAt = parsedStartedAt;
      payload.completedAt = parsedCompletedAt;
      payload.completionStatus = normalizedStatus;
      payload.loggedAt = parsedCompletedAt;
    } else {
      const parsedHours = parsePositiveNumber(hours);
      if (parsedHours === null) {
        return new NextResponse("Invalid log payload", { status: 400 });
      }

      logInstant = parseLogInstant(loggedAt) ?? new Date();
      payload.hours = parsedHours;
      payload.loggedAt = logInstant;
    }

    const date = deriveLogDate(logInstant, resolvedTimezone);
    payload.date = date;

    const log = await LogEntry.create({
      ...payload,
    });

    const response = NextResponse.json(log);
    scheduleCoachEmbeddingRefreshForLog(String(log._id));
    scheduleCoachEmbeddingBackfill(userId);
    scheduleImplicitMemoryRefreshFromLog(userId);
    scheduleSmartRecallEligibilityRefresh(String(log._id));
    scheduleSmartRecallEligibilityBackfill(userId);
    scheduleUsagePatternRecalc(userId, resolvedTimezone);

    return response;
  } catch (error: unknown) {
    console.error("[LOGS_POST_ERROR]", error);
    
    try {
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || 'unknown',
        context: "Server-LogsAPI-POST",
        errorMessage: error instanceof Error ? error.message : "Unknown Logs POST error",
        stackTrace: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : "Hidden in production",
      });
    } catch {}

    if (process.env.NODE_ENV === 'development') {
        return new NextResponse(error instanceof Error ? error.stack || "Internal Error" : "Internal Error", { status: 500 });
    }
    return new NextResponse("An anomaly occurred while saving logs.", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    await connectToDatabase();

    const query: { userId: string; date?: string } = { userId };
    if (date) query.date = date; // Simple matching; can extend to regex for month

    const logs = await LogEntry.find(query).sort({ loggedAt: -1, createdAt: -1 });

    return NextResponse.json(logs);
  } catch (error: unknown) {
    console.error("[LOGS_GET_ERROR]", error);
    
    try {
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || 'unknown',
        context: "Server-LogsAPI-GET",
        errorMessage: error instanceof Error ? error.message : "Unknown Logs GET error",
        stackTrace: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : "Hidden in production",
      });
    } catch {}

    if (process.env.NODE_ENV === 'development') {
        return new NextResponse(error instanceof Error ? error.stack || "Internal Error" : "Internal Error", { status: 500 });
    }
    return new NextResponse("An anomaly occurred while fetching logs.", { status: 500 });
  }
}
