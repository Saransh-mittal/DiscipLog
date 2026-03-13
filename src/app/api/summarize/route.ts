import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

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

    const prompt = `You are a productivity assistant summarizing a voice log for the category: "${category}".
    Create a highly concise, bulleted summary of this work (max 3 bullets). Avoid intro/outro text.
    Transcript: "${text}"`;

    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": process.env.SARVAM_API_KEY || "",
      },
      body: JSON.stringify({
        model: "sarvam-105b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam AI API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content?.trim();

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("[SUMMARIZE_ERROR]", error);

    // Centralized Error Logging Sink
    try {
      const { getServerSession } = require("next-auth");
      const { authOptions } = require("../auth/[...nextauth]/route");
      const session = await getServerSession(authOptions);

      const connectToDatabase = require("@/lib/mongoose").default;
      const ErrorLog = require("@/models/ErrorLog").default;
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || 'unknown',
        context: "Server-SummarizeAPI-SarvamAI",
        errorMessage: error?.message || "Unknown Sarvam AI Summarize error",
        stackTrace: process.env.NODE_ENV === 'development' ? error?.stack : "Hidden in production",
        userId: session?.user ? (session.user as any).id : undefined,
      });
    } catch (loggingError) {
      console.error("Failed to log summarize error to database", loggingError);
    }

    // Environment aware response
    if (process.env.NODE_ENV === 'development') {
      return new NextResponse(error.stack || "Internal Error", { status: 500 });
    }
    return new NextResponse("An anomaly occurred while summarizing.", { status: 500 });
  }
}
