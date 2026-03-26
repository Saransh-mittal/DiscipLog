import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import WeeklyDebrief from "@/models/WeeklyDebrief";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await connectToDatabase();

    // Get the latest unacknowledged debrief
    const debrief = await WeeklyDebrief.findOne({
      userId,
      acknowledgedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(debrief);
  } catch (error) {
    console.error("[DEBRIEFS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch debrief" },
      { status: 500 }
    );
  }
}
