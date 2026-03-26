import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import WeeklyDebrief from "@/models/WeeklyDebrief";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { id } = await params;

    await connectToDatabase();

    const result = await WeeklyDebrief.findOneAndUpdate(
      { _id: id, userId },
      { $set: { acknowledgedAt: new Date() } },
      { returnDocument: "after" }
    ).lean();

    if (!result) {
      return NextResponse.json(
        { error: "Debrief not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DEBRIEF_ACKNOWLEDGE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to acknowledge debrief" },
      { status: 500 }
    );
  }
}
