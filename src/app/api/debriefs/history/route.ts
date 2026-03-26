import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import WeeklyDebrief from "@/models/WeeklyDebrief";
import Commitment from "@/models/Commitment";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await connectToDatabase();

    // Get all acknowledged debriefs
    const debriefs = await WeeklyDebrief.find({
      userId,
      acknowledgedAt: { $ne: null },
    })
      .sort({ weekStartDate: -1 })
      .lean();

    const weekStarts = debriefs.map(d => d.weekStartDate);
    const commitments = await Commitment.find({
      userId,
      weekStart: { $in: weekStarts }
    }).lean();

    const debriefsWithCommitments = debriefs.map(d => {
      // mongoose lean type isn't implicitly extended, so any cast
      const doc = d as any;
      return {
        ...doc,
        commitments: commitments.filter(c => c.weekStart === doc.weekStartDate)
      };
    });

    return NextResponse.json(debriefsWithCommitments);
  } catch (error) {
    console.error("[DEBRIEFS_HISTORY_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch debrief history" },
      { status: 500 }
    );
  }
}
