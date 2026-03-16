import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import ThemeToggle from "@/components/ThemeToggle";
import DashboardNav from "@/components/DashboardNav";

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

  const greeting = getGreeting();
  const firstName = session.user?.name?.split(" ")[0] || "there";

  return (
    <TooltipProvider>
      <div className="v2 flex min-h-screen flex-col selection:bg-[oklch(0.65_0.19_60_/_30%)]">
        <div className="v2-accent-line w-full" />

        <header
          className="sticky top-0 z-50 border-b px-6 py-3 md:px-10"
          style={{
            borderColor: "var(--v2-border)",
            background: "var(--v2-surface)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h2
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Discip<span style={{ color: "var(--v2-amber-400)" }}>Log</span>
              </h2>

              <DashboardNav />
            </div>

            <div className="flex items-center gap-3">
              <span
                className="hidden text-sm md:block"
                style={{ color: "var(--v2-text-muted)" }}
              >
                {greeting},{" "}
                <span className="font-semibold" style={{ color: "var(--v2-amber-400)" }}>
                  {firstName}
                </span>
              </span>

              <ThemeToggle />

              <Avatar className="h-8 w-8 border" style={{ borderColor: "var(--v2-border-strong)" }}>
                <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{
                    background: "var(--v2-surface-raised)",
                    color: "var(--v2-amber-400)",
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

        <div className="v2-accent-line mt-auto w-full" />
      </div>
    </TooltipProvider>
  );
}
