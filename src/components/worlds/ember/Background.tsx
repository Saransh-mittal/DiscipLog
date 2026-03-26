"use client";

import { useEffect, useRef } from "react";

/** Ember Camp Background — warm charcoal with bottom-heavy radial glow + floating ember particles.
 *  OPTIMIZED: throttled to ~30fps, no per-frame gradient creation. */
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

    interface Ember {
      x: number; y: number; size: number; speed: number; opacity: number; drift: number;
    }
    const embers: Ember[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 30; i++) {
      embers.push({
        x: Math.random() * canvas.width,
        y: canvas.height * 0.5 + Math.random() * canvas.height * 0.5,
        size: Math.random() * 2.5 + 1,
        speed: Math.random() * 0.4 + 0.15,
        opacity: Math.random() * 0.5 + 0.2,
        drift: (Math.random() - 0.5) * 0.3,
      });
    }

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const e of embers) {
        e.y -= e.speed;
        e.x += e.drift + Math.sin(e.y * 0.01) * 0.2;
        e.opacity -= 0.0005;

        if (e.y < -10 || e.opacity <= 0) {
          e.y = canvas.height + 10;
          e.x = Math.random() * canvas.width;
          e.opacity = Math.random() * 0.5 + 0.2;
        }

        // Simple filled circle — no gradient per particle
        ctx.globalAlpha = e.opacity;
        ctx.fillStyle = "rgb(255, 160, 60)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
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
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 120% 60% at 50% 100%, oklch(0.22 0.06 45) 0%, oklch(0.14 0.02 42) 40%, oklch(0.10 0.008 38) 80%, oklch(0.09 0.005 35) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[35%] opacity-[0.10]"
        style={{
          background: "linear-gradient(to top, oklch(0.55 0.15 45), transparent)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
