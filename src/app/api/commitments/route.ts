import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import connectToDatabase from "@/lib/mongoose";
import Commitment from "@/models/Commitment";
import { getWeekStart, formatLocalDate } from "@/lib/logs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const weekStart = formatLocalDate(getWeekStart());

    await connectToDatabase();
    const commitments = await Commitment.find({ userId, weekStart }).sort({
      createdAt: -1,
    });

    return NextResponse.json(commitments);
  } catch (error) {
    console.error("[COMMITMENTS_GET_ERROR]", error);
    return new NextResponse("Failed to fetch commitments", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { text } = await req.json();

    if (!text?.trim()) {
      return new NextResponse("Commitment text required", { status: 400 });
    }

    const weekStart = formatLocalDate(getWeekStart());

    await connectToDatabase();
    const commitment = await Commitment.create({
      userId,
      text: text.trim(),
      weekStart,
    });

    return NextResponse.json(commitment);
  } catch (error) {
    console.error("[COMMITMENTS_POST_ERROR]", error);
    return new NextResponse("Failed to create commitment", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { commitmentId, status, rawReason } = await req.json();

    if (!commitmentId || !status) {
      return new NextResponse("Missing commitmentId or status", {
        status: 400,
      });
    }

    await connectToDatabase();
    const commitment = await Commitment.findOne({
      _id: commitmentId,
      userId,
    });

    if (!commitment) {
      return new NextResponse("Commitment not found", { status: 404 });
    }

    commitment.status = status;

    if (status === "completed") {
      commitment.completedAt = new Date();
    }

    if (status === "missed" && rawReason?.trim()) {
      // AI-enhance the reason
      try {
        const result = await generateText({
          model: openai("gpt-5-nano"),
          system: `You refine a user's raw explanation for missing a weekly commitment into a clear, honest, accountable statement. Keep it concise (1-2 sentences). Don't add fluff or excuses. Maintain the user's voice but make it articulate. Output ONLY the refined statement, nothing else.`,
          prompt: `Commitment: "${commitment.text}"\nRaw reason: "${rawReason.trim()}"`,
        });
        commitment.missedReason = result.text.trim();
      } catch {
        commitment.missedReason = rawReason.trim();
      }
    }

    await commitment.save();

    return NextResponse.json(commitment);
  } catch (error) {
    console.error("[COMMITMENTS_PATCH_ERROR]", error);
    return new NextResponse("Failed to update commitment", { status: 500 });
  }
}
