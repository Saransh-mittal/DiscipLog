"use client";

/** Basecamp Background — subtle dot grid pattern on dark charcoal. Clean and ready. */
export default function Background() {
  return (
    <div className="fixed inset-0 -z-50 pointer-events-none" aria-hidden="true">
      {/* Base color */}
      <div className="absolute inset-0" style={{ background: "oklch(0.13 0.005 260)" }} />
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
