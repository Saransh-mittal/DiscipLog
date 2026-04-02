import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { snoozeSmartRecallCard } from "@/lib/smart-recall";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const timezone =
    body && typeof body.timezone === "string" ? body.timezone : null;
  const summary = await snoozeSmartRecallCard({
    userId: (session.user as { id: string }).id,
    cardId: id,
    timezone,
  });

  if (!summary) {
    return NextResponse.json({ error: "Recall card not found" }, { status: 404 });
  }

  return NextResponse.json(summary);
}
