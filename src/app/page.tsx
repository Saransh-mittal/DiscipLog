import type { Metadata } from "next";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: "DiscipLog — AI-Powered Discipline Tracker | Build Focus Streaks",
  description:
    "DiscipLog is the AI-powered discipline tracking system. Log focus sessions with voice-to-text, build unbreakable streaks, get AI coaching, and visualize your expanding consistency. Free to start.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "DiscipLog — AI-Powered Discipline Tracker | Build Focus Streaks",
    description:
      "Log focus sessions with voice-to-text intelligence. Build unbreakable streaks. Get AI coaching. Visualize your expanding consistency.",
    url: "/",
  },
};

function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "DiscipLog",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://disciplog.com",
    description:
      "The AI-powered discipline tracking system. Log your focus sessions with voice-to-text intelligence, build streaks, and visualize your expanding consistency.",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Voice-to-text focus logging",
      "AI-powered coaching",
      "Streak tracking and gamification",
      "Daily and weekly progress visualization",
      "Smart recall and spaced repetition",
      "Sprint timer with Pomodoro support",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <main
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 selection:bg-white/20"
        style={{
          background: 'oklch(0.08 0 0)', 
          color: 'oklch(0.98 0 0)',      
          fontFamily: 'var(--font-body)',
        }}
      >
        <div 
          className="absolute top-[-100px] left-1/2 -ml-[300px] h-[200px] w-[600px] rounded-[100%] blur-[120px] pointer-events-none"
          style={{ background: 'oklch(0.85 0.15 260 / 15%)' }}
          aria-hidden="true"
        />

        <header className="relative z-10 max-w-3xl text-center">
          <div className="v2-stagger-in v2-stagger-1 mb-8 flex justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest backdrop-blur-md"
              style={{
                borderColor: "oklch(1 0 0 / 10%)",
                background: "oklch(1 0 0 / 3%)",
                color: "oklch(0.85 0.15 260)",
              }}
            >
              <span className="relative flex h-2 w-2 items-center justify-center" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "oklch(0.85 0.15 260)" }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.85 0.15 260)" }} />
              </span>
              AI-Powered Discipline
            </span>
          </div>

          <h1
            className="v2-stagger-in v2-stagger-2 mb-6 text-6xl font-extrabold leading-[0.9] tracking-tighter sm:text-7xl md:text-8xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Discip
            <span 
              className="bg-clip-text text-transparent"
              style={{ 
                backgroundImage: "linear-gradient(135deg, oklch(0.95 0.05 260), oklch(0.80 0.15 260))"
              }}
            >
              Log
            </span>
          </h1>

          <p
            className="v2-stagger-in v2-stagger-3 mx-auto mb-12 max-w-xl text-lg leading-relaxed md:text-xl"
            style={{ color: "oklch(0.65 0 0)" }} 
          >
            A minimalist, scalable discipline logging system. Track your focus with{" "}
            <strong className="font-semibold text-white">
              voice-to-text intelligence
            </strong>{" "}
            and visualize your expanding consistency.
          </p>
        </header>

        <section className="relative z-10">
          <div className="v2-stagger-in v2-stagger-4 flex justify-center">
            <Button
              asChild
              size="lg"
              className="group relative h-14 rounded-full px-10 text-base font-bold tracking-wide transition-all duration-300 hover:scale-[1.03]"
              style={{
                background: "oklch(0.98 0 0)", 
                color: "oklch(0.08 0 0)",      
                boxShadow: "0 0 40px oklch(0.85 0.15 260 / 20%), 0 0 0 1px oklch(1 0 0 / 10%) inset",
                fontFamily: "var(--font-display)",
                border: "none",
              }}
            >
              <Link href="/dashboard" className="flex items-center">
                Enter Dashboard
                <ChevronRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </section>

        <footer className="relative z-10 mt-16">
          <p
            className="v2-stagger-in v2-stagger-5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "oklch(0.45 0 0)" }}
          >
            Voice · Memory · Unyielding
          </p>
        </footer>

        <div 
          className="absolute bottom-0 left-0 w-full h-[1px]" 
          style={{ background: 'linear-gradient(90deg, transparent, oklch(1 0 0 / 10%), transparent)' }}
          aria-hidden="true"
        />
      </main>
    </>
  );
}

