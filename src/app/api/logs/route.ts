import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import LogEntry from "@/models/LogEntry";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { hours, category, rawTranscript, summary } = body;

    if (!hours || !category || !rawTranscript) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    await connectToDatabase();
    
    // YYYY-MM-DD
    const date = new Date().toISOString().split("T")[0];

    const log = await LogEntry.create({
      userId,
      date,
      hours: Number(hours),
      category,
      rawTranscript,
      aiSummary: summary,
    });

    return NextResponse.json(log);
  } catch (error: any) {
    console.error("[LOGS_POST_ERROR]", error);
    
    try {
      const ErrorLog = require("@/models/ErrorLog").default;
      await ErrorLog.create({
        environment: process.env.NODE_ENV || 'unknown',
        context: "Server-LogsAPI-POST",
        errorMessage: error?.message || "Unknown Logs POST error",
        stackTrace: process.env.NODE_ENV === 'development' ? error?.stack : "Hidden in production",
      });
    } catch (e) {}

    if (process.env.NODE_ENV === 'development') {
        return new NextResponse(error.stack || "Internal Error", { status: 500 });
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

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    await connectToDatabase();

    const query: any = { userId };
    if (date) query.date = date; // Simple matching; can extend to regex for month

    const logs = await LogEntry.find(query).sort({ createdAt: -1 });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("[LOGS_GET_ERROR]", error);
    
    try {
      const ErrorLog = require("@/models/ErrorLog").default;
      await ErrorLog.create({
        environment: process.env.NODE_ENV || 'unknown',
        context: "Server-LogsAPI-GET",
        errorMessage: error?.message || "Unknown Logs GET error",
        stackTrace: process.env.NODE_ENV === 'development' ? error?.stack : "Hidden in production",
      });
    } catch (e) {}

    if (process.env.NODE_ENV === 'development') {
        return new NextResponse(error.stack || "Internal Error", { status: 500 });
    }
    return new NextResponse("An anomaly occurred while fetching logs.", { status: 500 });
  }
}
