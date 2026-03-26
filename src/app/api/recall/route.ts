import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateDailyRecallFeed } from "@/lib/proactive-insights";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const timezone = searchParams.get("timezone");

  const feed = await generateDailyRecallFeed({
    userId,
    timezone,
  });

  return NextResponse.json(feed);
}
