import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";
import {
  getAIProfileWithMemoryMeta,
  getExplicitAIProfileResponse,
  parseExplicitAIProfile,
} from "@/lib/ai-profile";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    await connectToDatabase();
    const user = await User.findById(userId).lean();

    return NextResponse.json(getAIProfileWithMemoryMeta(user?.aiProfile));
  } catch (error) {
    console.error("[USER_PROFILE_GET_ERROR]", error);
    return new NextResponse("Failed to fetch AI profile", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const parsedProfile = parseExplicitAIProfile(await req.json(), {
      requirePersona: true,
    });

    if (!parsedProfile.ok) {
      return new NextResponse(parsedProfile.error, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "aiProfile.persona": parsedProfile.value.persona,
          "aiProfile.coreWhy": parsedProfile.value.coreWhy,
          "aiProfile.customInstructions": parsedProfile.value.customInstructions,
        },
      },
      { returnDocument: "after", runValidators: true }
    ).lean();

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    return NextResponse.json(getExplicitAIProfileResponse(user.aiProfile));
  } catch (error) {
    console.error("[USER_PROFILE_PUT_ERROR]", error);
    return new NextResponse("Failed to update AI profile", { status: 500 });
  }
}
