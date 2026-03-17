import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";
import OnboardingFlow from "@/components/OnboardingFlow";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  // Check if already onboarded
  await connectToDatabase();
  const user = await User.findOne({ email: session.user?.email }).lean();

  if (user?.onboardingCompleted) {
    redirect("/dashboard");
  }

  const firstName = session.user?.name?.split(" ")[0] || "there";

  return <OnboardingFlow userName={firstName} />;
}
