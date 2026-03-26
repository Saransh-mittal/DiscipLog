import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import PushSubscription from "@/models/PushSubscription";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();

    const { endpoint, keys, userAgent } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Invalid push subscription data" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Upsert by endpoint — a device can only have one subscription
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId,
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent: userAgent || "",
          lastUsedAt: new Date(),
          failCount: 0,
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PUSH_SUBSCRIBE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}
