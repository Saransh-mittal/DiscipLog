import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoose";
import ErrorLog from "@/models/ErrorLog";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as any).id : undefined;

    const body = await req.json();
    const { context, errorMessage, stackTrace, userContext, routePath } = body;

    // We never want the error logger itself to throw unhandled exceptions and crash
    if (!errorMessage || !context) {
      return new NextResponse("Missing required error fields", { status: 400 });
    }

    await connectToDatabase();

    await ErrorLog.create({
      environment: process.env.NODE_ENV || 'unknown',
      context,
      errorMessage,
      stackTrace,
      userContext,
      userId,
      routePath,
    });

    return NextResponse.json({ success: true, message: "Error securely logged." });
  } catch (error) {
     // Failsafe: if the DB is down or the logger crashes, gracefully allow the request to end
    console.error("[CRITICAL_LOGGER_FAILURE]", error);
    return new NextResponse("Logger failure", { status: 500 });
  }
}
