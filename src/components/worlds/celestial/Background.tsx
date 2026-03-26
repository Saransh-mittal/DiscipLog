"use client";

import { useEffect, useRef } from "react";

/** Obsidian Sanctum Background — flat black stone + golden snowfall.
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

    interface GoldFlake {
      x: number; y: number;
      size: number; speed: number; opacity: number;
      drift: number; wobbleSpeed: number; wobblePhase: number;
    }

    const flakes: GoldFlake[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 30 golden snowflakes (reduced from 45)
    for (let i = 0; i < 30; i++) {
      const isBig = Math.random() < 0.15;
      flakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: isBig ? Math.random() * 2.5 + 1.5 : Math.random() * 1.2 + 0.4,
        speed: isBig ? Math.random() * 0.5 + 0.35 : Math.random() * 0.3 + 0.12,
        opacity: isBig ? Math.random() * 0.5 + 0.35 : Math.random() * 0.35 + 0.15,
        drift: (Math.random() - 0.5) * 0.15,
        wobbleSpeed: Math.random() * 0.01 + 0.004,
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
        f.x += f.drift + Math.sin(f.wobblePhase) * 0.2;

        if (f.y > canvas.height + 10) {
          f.y = -10;
          f.x = Math.random() * canvas.width;
        }
        if (f.x < -10) f.x = canvas.width + 10;
        if (f.x > canvas.width + 10) f.x = -10;

        // Simple filled circle — no per-frame gradient (was 3 gradient calls per flake!)
        ctx.globalAlpha = f.opacity;
        ctx.fillStyle = "rgb(235, 200, 120)";
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
    <div className="fixed inset-0 -z-50 pointer-events-none" aria-hidden="true">
      {/* Flat solid black */}
      <div
        className="absolute inset-0"
        style={{ background: "oklch(0.045 0.002 75)" }}
      />
      {/* Paper grain — static CSS pattern, no SVG feTurbulence */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(oklch(1 0 0) 0.5px, transparent 0.5px)",
          backgroundSize: "4px 4px",
        }}
      />
      {/* Golden snowfall canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
