"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMomentum } from "@/components/MomentumProvider";
import type { CompletionSound } from "@/lib/momentum";

/** Module-level ref so external code can call playSound imperatively */
let _playSoundFn: ((type: CompletionSound) => void) | null = null;

/** Imperative trigger — call from preview buttons etc. */
export function triggerSound(type: CompletionSound) {
  if (_playSoundFn) _playSoundFn(type);
}

export default function SoundManager() {
  const { microInteractions } = useMomentum();
  const { completionSound } = microInteractions;
  const ctxRef = useRef<AudioContext | null>(null);

  // Ensure AudioContext exists
  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playSound = useCallback((type: CompletionSound) => {
    if (type === "none") return;
    // Check if muted in localStorage
    if (typeof window !== "undefined" && localStorage.getItem("disciplog-sound-muted") === "true") return;

    const ctx = ensureCtx();
    const t = ctx.currentTime;

    if (type === "forge-hammer") {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(80, t);
      osc2.frequency.setValueAtTime(200, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.12);
      osc2.stop(t + 0.12);
    }
    else if (type === "wind-chime") {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(800, t);
      osc2.frequency.setValueAtTime(1200, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.35);
      osc2.stop(t + 0.35);
    }
    else if (type === "deep-resonance") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(120, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.7);
    }
  }, [ensureCtx]);

  // Register module-level function for imperative access
  useEffect(() => {
    _playSoundFn = playSound;
    return () => { _playSoundFn = null; };
  }, [playSound]);

  // Auto-play when completionSound state changes (real dashboard use)
  const prevSound = useRef<CompletionSound>("none");
  useEffect(() => {
    if (completionSound !== "none" && completionSound !== prevSound.current) {
      playSound(completionSound);
    }
    prevSound.current = completionSound;
  }, [completionSound, playSound]);

  return null; // pure behavior, no UI
}
