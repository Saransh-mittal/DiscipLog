import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import { getDateKeyInTimezone } from "@/lib/logs";
import Nudge from "@/models/Nudge";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active") === "true";
    const timezone = searchParams.get("timezone") || "Asia/Kolkata";

    await connectToDatabase();

    const query: Record<string, unknown> = { userId };

    if (active) {
      const todayKey = getDateKeyInTimezone(timezone);
      query.dateKey = todayKey;
      query.dismissedAt = null;
    }

    const nudges = await Nudge.find(query)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json(nudges);
  } catch (error) {
    console.error("[NUDGES_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch nudges" },
      { status: 500 }
    );
  }
}
