"use client";

import { useEffect, useRef } from "react";

/** Iron Forge Background — deep charcoal with radial amber glow + spark particles.
 *  OPTIMIZED: throttled to ~30fps, no per-frame gradient, reduced draw calls. */
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

    interface Spark {
      x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; size: number;
    }
    const sparks: Spark[] = [];
    let spawnTimer = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnSpark = () => {
      const cx = canvas.width * (0.3 + Math.random() * 0.4);
      const cy = canvas.height * (0.7 + Math.random() * 0.3);
      sparks.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(Math.random() * 2 + 1),
        life: 0,
        maxLife: 60 + Math.random() * 60,
        size: Math.random() * 2 + 0.5,
      });
    };

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      spawnTimer++;
      if (spawnTimer % 6 === 0 && sparks.length < 35) spawnSpark();

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.01;
        s.life++;

        const progress = s.life / s.maxLife;
        const opacity = progress < 0.2 ? progress * 5 : 1 - progress;

        if (s.life >= s.maxLife || opacity <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        // Simple circles — no gradient per particle
        ctx.globalAlpha = opacity * 0.8;
        ctx.fillStyle = "rgb(255, 200, 80)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
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
          background: "radial-gradient(ellipse 140% 100% at 50% 100%, oklch(0.22 0.08 45) 0%, oklch(0.14 0.03 42) 50%, oklch(0.10 0.01 38) 100%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
