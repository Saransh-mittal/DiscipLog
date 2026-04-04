import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";

const VALID_PRO_MODELS = ["gpt-5-mini", "gpt-5"] as const;

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json();
    const { preferredModel } = body;

    if (!preferredModel || !VALID_PRO_MODELS.includes(preferredModel)) {
      return NextResponse.json(
        { error: "Invalid model. Must be one of: gpt-5-mini, gpt-5" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify user is on pro plan
    const user = await User.findById(userId).select("subscription").lean();
    if (!user || user.subscription?.plan !== "pro") {
      return NextResponse.json(
        { error: "Model selection is only available for Pro subscribers." },
        { status: 403 }
      );
    }

    await User.findByIdAndUpdate(userId, {
      $set: { "subscription.preferredModel": preferredModel },
    });

    return NextResponse.json({ ok: true, preferredModel });
  } catch (error) {
    console.error("[SETTINGS_MODEL_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update model preference." },
      { status: 500 }
    );
  }
}
