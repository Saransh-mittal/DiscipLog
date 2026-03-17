import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";
import { ALLOWED_ICONS } from "@/lib/icons";

const ICON_LIST = ALLOWED_ICONS.join(", ");

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { description } = await req.json();

    if (!description?.trim()) {
      return new NextResponse("Description required", { status: 400 });
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You parse a user's free-text description of how they spend their time into structured productivity categories.

RULES:
- Output ONLY valid JSON. No markdown, no explanation, no code fences.
- Return an array of 2–7 category objects.
- Each object: { "name": string, "dailyTargetHours": number, "weeklyMinTarget": number, "weeklyMaxTarget": number, "icon": string }
- "name": short, clear label (2-3 words max). NO "Other" or catch-all categories.
- "dailyTargetHours": reasonable daily hours (0.5–8). Must sum to a realistic workday.
- "weeklyMinTarget" and "weeklyMaxTarget": weekly hour ranges (weeklyMin < weeklyMax). Typically dailyTarget × 5-7 days.
- "icon": MUST be one of these Lucide icon names: ${ICON_LIST}. Pick the most semantically relevant icon for each category.
- Sort by importance/time commitment (highest first).`,
      prompt: `Description: "${description.trim()}"`,
    });

    let categories;
    try {
      const cleaned = result.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
      categories = JSON.parse(cleaned);
    } catch {
      return new NextResponse("AI returned invalid format", { status: 502 });
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      return new NextResponse("AI returned empty categories", { status: 502 });
    }

    // Clamp to 7
    categories = categories.slice(0, 7);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[ONBOARDING_POST_ERROR]", error);
    return new NextResponse("Failed to generate categories", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { categories } = await req.json();

    if (!Array.isArray(categories) || categories.length === 0) {
      return new NextResponse("At least one category required", { status: 400 });
    }

    if (categories.length > 7) {
      return new NextResponse("Maximum 7 categories allowed", { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findByIdAndUpdate(
      userId,
      { categories, onboardingCompleted: true },
      { new: true, runValidators: true }
    );

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    return NextResponse.json({ success: true, categories: user.categories });
  } catch (error) {
    console.error("[ONBOARDING_PATCH_ERROR]", error);
    return new NextResponse("Failed to save onboarding", { status: 500 });
  }
}
