import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await connectToDatabase();
    const user = await User.findById(userId).lean();

    return NextResponse.json(user?.categories || []);
  } catch (error) {
    console.error("[CATEGORIES_GET_ERROR]", error);
    return new NextResponse("Failed to fetch categories", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { categories } = await req.json();

    if (!Array.isArray(categories)) {
      return new NextResponse("Invalid categories payload", { status: 400 });
    }

    if (categories.filter((c: { isArchived?: boolean }) => !c.isArchived).length > 8) {
      return new NextResponse("Maximum 8 active categories allowed", { status: 400 });
    }

    // Validate each category
    for (const cat of categories) {
      if (
        !cat.name?.trim() ||
        typeof cat.dailyTargetHours !== "number" ||
        typeof cat.weeklyMinTarget !== "number" ||
        typeof cat.weeklyMaxTarget !== "number" ||
        !cat.icon?.trim()
      ) {
        return new NextResponse("Invalid category format", { status: 400 });
      }
    }

    await connectToDatabase();
    const user = await User.findByIdAndUpdate(
      userId,
      { categories },
      { returnDocument: "after", runValidators: true }
    );

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    return NextResponse.json(user.categories);
  } catch (error) {
    console.error("[CATEGORIES_PUT_ERROR]", error);
    return new NextResponse("Failed to update categories", { status: 500 });
  }
}
