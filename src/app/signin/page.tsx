"use client";

import { signIn } from "next-auth/react";
import { Flame } from "lucide-react";
import { useState } from "react";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[oklch(0.12_0.01_250)] text-white">
      {/* Background ambient glows */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.6_0.2_30 / 15%) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        <div 
          className="overflow-hidden rounded-3xl border border-[oklch(1_0_0/10%)] bg-[oklch(0.15_0.01_250/60%)] p-10 text-center shadow-2xl backdrop-blur-xl transition-all duration-700 hover:border-[oklch(1_0_0/20%)] hover:shadow-[0_0_40px_oklch(0.6_0.2_30/10%)]"
        >
          <div className="mb-8 flex justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-[oklch(1_0_0/10%)] bg-gradient-to-br from-[oklch(0.2_0.02_250)] to-[oklch(0.15_0.01_250)] shadow-inner">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[oklch(0.7_0.2_30/20%)] to-transparent opacity-50 ring-1 ring-inset ring-white/10" />
              <Flame className="h-10 w-10 text-[oklch(0.7_0.2_30)]" />
            </div>
          </div>

          <h1 
            className="mb-3 text-4xl font-extrabold tracking-tight"
            style={{ fontFamily: "var(--font-display, sans-serif)" }}
          >
            DiscipLog
          </h1>
          <p className="mb-10 text-sm leading-relaxed text-[oklch(0.7_0.01_250)]">
            Log your progress to build tomorrow&apos;s edge.
          </p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-2xl border border-[oklch(1_0_0/10%)] bg-[oklch(0.2_0.02_250)] px-6 py-4 text-sm font-semibold text-white shadow-[0_8px_32px_transparent] transition-all duration-500 hover:scale-[1.02] hover:border-[oklch(0.7_0.2_30/40%)] hover:bg-[oklch(0.25_0.02_250)] hover:shadow-[0_8px_32px_oklch(0.7_0.2_30/20%)] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            {/* Inner top gloss */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            
            {/* Hover ambient spotlight */}
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" style={{ background: "radial-gradient(circle at center, oklch(0.7_0.2_30 / 15%) 0%, transparent 70%)" }} />

            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[oklch(0.7_0.2_30/20%)] border-t-[oklch(0.7_0.2_30)]" />
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white p-1.5 shadow-[0_0_20px_oklch(1_1_1/15%)] transition-transform duration-500 group-hover:scale-110 group-hover:shadow-[0_0_20px_oklch(1_1_1/30%)]">
                  <svg className="h-full w-full" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </div>
                <span className="tracking-wide">Sign in with Google</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
