import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="v2 relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div className="v2-accent-line absolute top-0 left-0 w-full" />

      <div className="relative z-10 max-w-3xl text-center">
        <div className="v2-stagger-in v2-stagger-1 mb-8">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{
              borderColor: "var(--v2-border-strong)",
              color: "var(--v2-amber-400)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--v2-amber-400)",
              }}
            />
            AI-Powered Discipline Tracking
          </span>
        </div>

        <h1
          className="v2-stagger-in v2-stagger-2 mb-6 text-6xl font-extrabold leading-[0.9] tracking-tighter sm:text-7xl md:text-8xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Discip
          <span style={{ color: "var(--v2-amber-400)" }}>Log</span>
        </h1>

        <p
          className="v2-stagger-in v2-stagger-3 mx-auto mb-12 max-w-xl text-lg leading-relaxed md:text-xl"
          style={{ color: "var(--v2-text-secondary)" }}
        >
          A robust, scalable discipline-logging application. Track your working
          hours with{" "}
          <span className="font-semibold" style={{ color: "var(--v2-amber-400)" }}>
            AI-powered voice-to-text
          </span>{" "}
          and see your consistency come alive.
        </p>

        <div className="v2-stagger-in v2-stagger-4">
          <Button
            asChild
            size="lg"
            className="relative h-14 rounded-full px-10 text-base font-bold tracking-wide transition-all duration-300 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, var(--v2-amber-500), var(--v2-amber-600))",
              color: "var(--v2-obsidian-900)",
              fontFamily: "var(--font-display)",
              border: "none",
            }}
          >
            <Link href="/dashboard">
              Enter Dashboard
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-2"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </Button>
        </div>

        <p
          className="v2-stagger-in v2-stagger-5 mt-16 text-xs uppercase tracking-widest"
          style={{ color: "var(--v2-text-muted)" }}
        >
          Voice · Text · AI Summaries · Calendar Heatmap
        </p>
      </div>

      <div className="v2-accent-line absolute bottom-0 left-0 w-full" />
    </div>
  );
}
