import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      <header className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">DiscipLog</h2>
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-zinc-400">{session.user?.email}</span>
          <a href="/api/auth/signout" className="text-sm font-semibold text-rose-400 hover:text-rose-300 transition-colors">Logout</a>
        </div>
      </header>
      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full relative">
        {children}
      </main>
    </div>
  );
}
