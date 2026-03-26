"use client";

import { useEffect, useRef } from "react";

/** Sky Citadel Background — deep blue gradient + drifting CSS cloud layers + canvas snowfall.
 *  OPTIMIZED: throttled to ~30fps, no per-frame gradient, reduced particles. */
export default function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let lastFrame = 0;
    const FRAME_INTERVAL = 33; // ~30fps

    interface Flake {
      x: number; y: number;
      size: number;
      speed: number;
      opacity: number;
      drift: number;
      wobbleSpeed: number;
      wobblePhase: number;
    }

    const flakes: Flake[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 35 snowflakes (reduced from 50)
    for (let i = 0; i < 35; i++) {
      const isBig = Math.random() < 0.2;
      flakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: isBig ? Math.random() * 3 + 2 : Math.random() * 1.5 + 0.5,
        speed: isBig ? Math.random() * 0.5 + 0.3 : Math.random() * 0.25 + 0.08,
        opacity: isBig ? Math.random() * 0.4 + 0.3 : Math.random() * 0.3 + 0.15,
        drift: (Math.random() - 0.5) * 0.3,
        wobbleSpeed: Math.random() * 0.015 + 0.005,
        wobblePhase: Math.random() * Math.PI * 2,
      });
    }

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const f of flakes) {
        f.y += f.speed;
        f.wobblePhase += f.wobbleSpeed;
        f.x += f.drift + Math.sin(f.wobblePhase) * 0.4;

        if (f.y > canvas.height + 10) {
          f.y = -10;
          f.x = Math.random() * canvas.width;
        }
        if (f.x < -10) f.x = canvas.width + 10;
        if (f.x > canvas.width + 10) f.x = -10;

        // Simple filled circle — no per-frame gradient
        ctx.globalAlpha = f.opacity;
        ctx.fillStyle = "rgb(220, 235, 255)";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-50 pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, oklch(0.15 0.03 240) 0%, oklch(0.22 0.04 235) 40%, oklch(0.28 0.03 230) 100%)",
        }}
      />

      {/* Cloud layer 1 — GPU-composited via will-change */}
      <div
        className="absolute w-[200%] h-[30%] bottom-[15%] opacity-[0.06]"
        style={{
          background: "radial-gradient(ellipse 40% 100% at 20% 50%, oklch(1 0 0) 0%, transparent 70%), radial-gradient(ellipse 35% 100% at 60% 50%, oklch(1 0 0) 0%, transparent 70%), radial-gradient(ellipse 30% 100% at 85% 50%, oklch(1 0 0) 0%, transparent 70%)",
          animation: "cloud-drift 45s linear infinite",
          willChange: "transform",
        }}
      />

      {/* Cloud layer 2 */}
      <div
        className="absolute w-[200%] h-[20%] bottom-[25%] opacity-[0.04]"
        style={{
          background: "radial-gradient(ellipse 25% 100% at 15% 50%, oklch(1 0 0) 0%, transparent 60%), radial-gradient(ellipse 30% 100% at 50% 50%, oklch(1 0 0) 0%, transparent 60%), radial-gradient(ellipse 20% 100% at 80% 50%, oklch(1 0 0) 0%, transparent 60%)",
          animation: "cloud-drift 30s linear infinite",
          animationDelay: "-10s",
          willChange: "transform",
        }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <style>{`
        @keyframes cloud-drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
