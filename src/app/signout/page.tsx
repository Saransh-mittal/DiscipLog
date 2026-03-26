"use client";

import { signOut } from "next-auth/react";
import { LogOut, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setLoading(true);
    await signOut({ callbackUrl: "/signin" });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[oklch(0.12_0.01_250)] text-white">
      {/* Background ambient glows */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.5_0.15_28 / 12%) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 w-full max-w-sm px-6">
        <div 
          className="overflow-hidden rounded-3xl border border-[oklch(1_0_0/10%)] bg-[oklch(0.15_0.01_250/60%)] p-10 text-center shadow-2xl backdrop-blur-xl transition-all duration-700"
        >
          <div className="mb-6 flex justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] border border-[oklch(1_0_0/15%)] bg-gradient-to-b from-[oklch(0.2_0.02_250)] to-[oklch(0.13_0.01_250)] shadow-[0_8px_32px_oklch(0_0_0/40%)]">
              <LogOut className="h-8 w-8 text-[oklch(0.7_0.15_28)]" />
            </div>
          </div>

          <h1 
            className="mb-3 text-2xl font-bold tracking-tight md:text-3xl"
            style={{ fontFamily: "var(--font-display, sans-serif)" }}
          >
            Leaving Earth?
          </h1>
          <p className="mb-10 text-sm leading-relaxed text-[oklch(0.7_0.01_250)]">
            You are about to sign out of your account. Do you wish to proceed?
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="relative flex w-full items-center justify-center gap-2 rounded-2xl bg-[oklch(0.3_0.1_28)] px-5 py-3.5 text-sm font-bold text-white transition-all hover:bg-[oklch(0.4_0.15_28)] hover:shadow-[0_0_20px_oklch(0.4_0.15_28/30%)] active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                 <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                "Sign Out"
              )}
            </button>
            <button
              onClick={() => router.back()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[oklch(1_0_0/10%)] bg-[oklch(1_0_0/3%)] px-5 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[oklch(1_0_0/8%)] active:scale-95 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to forge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
