import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Image from "next/image";
import appIcon from "@/app/icon.png";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: "noindex, nofollow",
};
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardNav from "@/components/DashboardNav";
import FrictionBanner from "@/components/FrictionBanner";
import { CategoriesProvider } from "@/components/CategoriesProvider";
import DashboardClientShell from "@/components/DashboardClientShell";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Burning the midnight oil";
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  await connectToDatabase();
  const user = await User.findOne({ email: session.user?.email }).lean();

  if (!user?.onboardingCompleted) {
    redirect("/onboarding");
  }

  const greeting = getGreeting();
  const firstName = session.user?.name?.split(" ")[0] || "there";

  return (
    <TooltipProvider>
      <CategoriesProvider>
        <DashboardClientShell>
          <div className="v2 flex min-h-screen flex-col selection:bg-[oklch(0.65_0.19_60_/_30%)]">
            {/* Top accent line */}
            <div className="world-accent-line w-full" style={{ position: "relative", zIndex: 51 }} />

            {/* AI Coach Nudge Banner */}
            <FrictionBanner />

            <header
              className="sticky top-0 z-50 border-b px-6 py-3 md:px-10"
              style={{
                borderColor: "var(--world-header-border, var(--v2-border))",
                background: "var(--world-header-bg, color-mix(in oklch, var(--v2-surface) 85%, transparent))",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                transition: "background 800ms ease, border-color 800ms ease",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center">
                    <Image src={appIcon} alt="DiscipLog Icon" width={36} height={36} className="rounded-md shadow-sm" />
                    <h2
                      className="text-lg font-bold tracking-tight"
                      style={{ fontFamily: "var(--font-display)", color: "var(--world-text-primary, oklch(0.82 0.008 260))" }}
                    >
                      Discip<span style={{ color: "var(--world-accent, oklch(0.60 0.06 260))" }}>Log</span>
                    </h2>
                  </div>

                  <DashboardNav />
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className="hidden text-sm md:block"
                    style={{ color: "var(--world-text-muted, var(--v2-text-muted))" }}
                  >
                    {greeting},{" "}
                    <span className="font-semibold" style={{ color: "var(--world-accent, var(--v2-amber-400))" }}>
                      {firstName}
                    </span>
                  </span>

                  <Avatar className="h-8 w-8 border" style={{ borderColor: "var(--world-header-border, var(--v2-border-strong))" }}>
                    <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                    <AvatarFallback
                      className="text-xs font-bold"
                      style={{
                        background: "var(--v2-surface-raised)",
                        color: "var(--world-accent, var(--v2-amber-400))",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {getInitials(session.user?.name)}
                    </AvatarFallback>
                  </Avatar>

                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold tracking-wide"
                    style={{ color: "var(--v2-rose-400)", fontFamily: "var(--font-body)" }}
                  >
                    <Link href="/api/auth/signout">
                      Logout
                    </Link>
                  </Button>
                </div>
              </div>
            </header>

            <main className="relative mx-auto flex-1 w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
              {children}
            </main>

            {/* Bottom accent line */}
            <div className="world-accent-line mt-auto w-full" />
          </div>
        </DashboardClientShell>
      </CategoriesProvider>
    </TooltipProvider>
  );
}
