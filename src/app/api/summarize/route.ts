import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectToDatabase from "@/lib/mongoose";
import ErrorLog from "@/models/ErrorLog";
import { authOptions } from "../auth/[...nextauth]/route";
import { generateLogSummary } from "@/lib/log-summary";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown summarize error";
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { text, category } = await req.json();

    if (!text) {
      return new NextResponse("Missing text", { status: 400 });
    }

    const summary = await generateLogSummary({ text, category });

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    console.error("[SUMMARIZE_ERROR]", error);

    // Centralized Error Logging Sink
    try {
      const session = await getServerSession(authOptions);
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || "unknown",
        context: "Server-SummarizeAPI",
        errorMessage: getErrorMessage(error),
        stackTrace:
          process.env.NODE_ENV === "development"
            ? getErrorStack(error)
            : "Hidden in production",
        userId: session?.user
          ? (session.user as { id?: string }).id
          : undefined,
      });
    } catch (loggingError) {
      console.error("Failed to log summarize error to database", loggingError);
    }

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

    // Environment aware response
    if (process.env.NODE_ENV === "development") {
      return new NextResponse(getErrorStack(error) || "Internal Error", { status: 500 });
    }
    return new NextResponse("An anomaly occurred while summarizing.", { status: 500 });
  }
}
