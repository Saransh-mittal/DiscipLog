import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import Nudge from "@/models/Nudge";

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

    const result = await Nudge.findOneAndUpdate(
      { _id: id, userId },
      { $set: { dismissedAt: new Date() } },
      { returnDocument: "after" }
    ).lean();

    if (!result) {
      return NextResponse.json(
        { error: "Nudge not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[NUDGE_DISMISS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to dismiss nudge" },
      { status: 500 }
    );
  }
}
