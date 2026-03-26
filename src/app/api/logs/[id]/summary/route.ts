import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import ErrorLog from "@/models/ErrorLog";
import LogEntry from "@/models/LogEntry";
import {
  scheduleCoachEmbeddingBackfill,
  scheduleCoachEmbeddingRefreshForLog,
} from "@/lib/coach-embeddings";
import { generateLogSummary } from "@/lib/log-summary";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown retry summary error";
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    // Next.js requires unwrapping dynamic route params via await
    const unwrappedParams = await params;
    const id = unwrappedParams.id;

    await connectToDatabase();

    const log = await LogEntry.findOne({ _id: id, userId });
    if (!log) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (!log.rawTranscript) {
      return new NextResponse("No raw transcript to summarize", { status: 400 });
    }

    const summary = await generateLogSummary({
      text: log.rawTranscript,
      category: log.category,
    });

    // Save back to DB
    log.aiSummary = summary;
    await log.save();
    scheduleCoachEmbeddingRefreshForLog(String(log._id));
    scheduleCoachEmbeddingBackfill(userId);

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    console.error("[RETRY_SUMMARY_ERROR]", error);
    
    // Centralized Error Logging Sink
    try {
      const session = await getServerSession(authOptions);

      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || 'unknown',
        context: "Server-RetrySummaryAPI",
        errorMessage: getErrorMessage(error),
        stackTrace: process.env.NODE_ENV === 'development' ? getErrorStack(error) : "Hidden in production",
        userId: session?.user ? (session.user as { id?: string }).id : undefined,
      });
    } catch {}

    if (
      getErrorMessage(error).includes("insufficient_quota") ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "insufficient_quota") ||
      (typeof error === "object" &&
        error !== null &&
        "type" in error &&
        error.type === "insufficient_quota")
    ) {
      return new NextResponse("Service unavailable: OpenAI quota exceeded. Please check billing details.", { status: 503 });
    }

    if (process.env.NODE_ENV === 'development') {
      return new NextResponse(getErrorMessage(error) || getErrorStack(error) || "Internal Error", { status: 500 });
    }
    return new NextResponse("An anomaly occurred while retrying the summary.", { status: 500 });
  }
}
