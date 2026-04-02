import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { markSmartRecallTutorialSeen } from "@/lib/smart-recall";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await markSmartRecallTutorialSeen((session.user as { id: string }).id);

  return NextResponse.json({ ok: true });
}
