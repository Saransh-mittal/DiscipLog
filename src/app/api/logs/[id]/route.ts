import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import ErrorLog from "@/models/ErrorLog";
import {
  deriveLogDate,
  isValidLogCategory,
  isValidTimezone,
  parseLogInstant,
} from "@/lib/logs";
import {
  scheduleCoachEmbeddingBackfill,
  scheduleCoachEmbeddingRefreshForLog,
} from "@/lib/coach-embeddings";
import LogEntry from "@/models/LogEntry";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown log mutation error";
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { id } = await params;
    const body = await req.json();
    const { hours, category, rawTranscript, aiSummary, loggedAt, timezone } =
      body;

    const parsedHours = Number(hours);
    const parsedLoggedAt = parseLogInstant(loggedAt);

    if (
      !Number.isFinite(parsedHours) ||
      parsedHours <= 0 ||
      typeof rawTranscript !== "string" ||
      !rawTranscript.trim() ||
      typeof aiSummary !== "string" ||
      typeof category !== "string" ||
      !isValidLogCategory(category) ||
      !parsedLoggedAt ||
      !isValidTimezone(timezone)
    ) {
      return new NextResponse("Invalid log payload", { status: 400 });
    }

    await connectToDatabase();

    const log = await LogEntry.findOne({ _id: id, userId });
    if (!log) {
      return new NextResponse("Not Found", { status: 404 });
    }

    log.hours = parsedHours;
    log.category = category;
    log.rawTranscript = rawTranscript.trim();
    log.aiSummary = aiSummary.trim();
    log.loggedAt = parsedLoggedAt;
    log.date = deriveLogDate(parsedLoggedAt, timezone);

    await log.save();
    scheduleCoachEmbeddingRefreshForLog(String(log._id));
    scheduleCoachEmbeddingBackfill(userId);

    return NextResponse.json(log);
  } catch (error: unknown) {
    console.error("[LOGS_PATCH_ERROR]", error);

    try {
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || "unknown",
        context: "Server-LogsAPI-PATCH",
        errorMessage: getErrorMessage(error),
        stackTrace:
          process.env.NODE_ENV === "development"
            ? getErrorStack(error)
            : "Hidden in production",
      });
    } catch {}

    if (process.env.NODE_ENV === "development") {
      return new NextResponse(getErrorStack(error) || "Internal Error", {
        status: 500,
      });
    }
    return new NextResponse("An anomaly occurred while updating logs.", {
      status: 500,
    });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { id } = await params;

    await connectToDatabase();

    const deletedLog = await LogEntry.findOneAndDelete({ _id: id, userId });
    if (!deletedLog) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[LOGS_DELETE_ERROR]", error);

    try {
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || "unknown",
        context: "Server-LogsAPI-DELETE",
        errorMessage: getErrorMessage(error),
        stackTrace:
          process.env.NODE_ENV === "development"
            ? getErrorStack(error)
            : "Hidden in production",
      });
    } catch {}

    if (process.env.NODE_ENV === "development") {
      return new NextResponse(getErrorStack(error) || "Internal Error", {
        status: 500,
      });
    }
    return new NextResponse("An anomaly occurred while deleting logs.", {
      status: 500,
    });
  }
}
