"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Clock, TrendingUp, Volume2, PartyPopper } from "lucide-react";
import MomentumProvider, { useMomentum } from "@/components/MomentumProvider";
import WorldRenderer, { useWorld } from "@/components/worlds/WorldRenderer";
import type { MomentumState, CompletionSound } from "@/lib/momentum";
import { triggerSound } from "@/components/SoundManager";
import confetti from "canvas-confetti";

const MomentumFlame = dynamic(() => import("@/components/MomentumFlame"), { ssr: false });
const DailyProgressV2 = dynamic(() => import("@/components/DailyProgressV2"), { ssr: false });
const WeeklyProgressV2 = dynamic(() => import("@/components/WeeklyProgressV2"), { ssr: false });
const SoundManager = dynamic(() => import("@/components/SoundManager"), { ssr: false });
const CompletionCelebration = dynamic(() => import("@/components/CompletionCelebration"), { ssr: false });

/* ────────────────────────────────────────────────
   Realistic user journey presets
   Targets: PB 2.5h, FP 2.5h, DL 1h, RR 0.5h (optional)
   Daily total target: 6.5h (main cats only)
   ──────────────────────────────────────────────── */

interface Preset {
  label: string;
  day: string;
  story: string;
  state: Partial<MomentumState>;
}

const PRESETS: Preset[] = [
  // ── TIER 0: BASECAMP ──────────────────────────────
  {
    label: "🏕️ Basecamp — Fresh Start",
    day: "Day 0",
    story: "You just signed up. No logs yet. The Basecamp is quiet and clean — a blank canvas ready for your first mark.",
    state: {
      dailyEnergy: 0, dailyEnergyTier: "cold",
      streakPower: 0, streakPowerTier: "dormant",
      todayHours: 0, todayLogCount: 0, todayTargetPercent: 0,
      weeklyHours: 0, streakDays: 0,
      todayByCategory: {},
      weeklyByCategory: {},
    },
  },
  {
    label: "🏕️ Basecamp — First Spark",
    day: "Day 0, 10am",
    story: "You logged your first 30-min session. A tiny spark. 'Hover Lift' unlocks (cards lift slightly).",
    state: {
      dailyEnergy: 1, dailyEnergyTier: "spark",
      streakPower: 0, streakPowerTier: "dormant",
      todayHours: 0.5, todayLogCount: 1, todayTargetPercent: 8,
      weeklyHours: 0.5, streakDays: 0,
      todayByCategory: { "Project Building": 0.5 },
      weeklyByCategory: { "Project Building": 0.5 },
    },
  },
  {
    label: "🏕️ Basecamp — Half Day",
    day: "Day 0, 3pm",
    story: "Hit 50% daily target. 'Hover Glow' and 'Completion Pulse' now unlocked for done cards.",
    state: {
      dailyEnergy: 3, dailyEnergyTier: "warming",
      streakPower: 0, streakPowerTier: "dormant",
      todayHours: 3.5, todayLogCount: 4, todayTargetPercent: 55,
      weeklyHours: 3.5, streakDays: 0,
      todayByCategory: { "Project Building": 1.5, "Focused Practice": 1.5, "Daily Learning": 0.5 },
      weeklyByCategory: { "Project Building": 1.5, "Focused Practice": 1.5, "Daily Learning": 0.5 },
    },
  },

  // ── TIER 1: EMBER CAMP ─────────────────────────────
  {
    label: "🔥 Ember Camp — Ignited",
    day: "Day 1, 6pm",
    story: "Hit all targets! Welcome to Ember Camp. Card 'Fade-in' entrance unlocked. Confetti celebration available on 100% hit.",
    state: {
      dailyEnergy: 5, dailyEnergyTier: "peak",
      streakPower: 1, streakPowerTier: "ember",
      todayHours: 6.5, todayLogCount: 8, todayTargetPercent: 100,
      weeklyHours: 9.7, streakDays: 1,
      todayByCategory: { "Project Building": 2.5, "Focused Practice": 2.5, "Daily Learning": 1.0, "Rapid Recap": 0.5 },
      weeklyByCategory: { "Project Building": 4, "Focused Practice": 3.7, "Daily Learning": 1.5, "Rapid Recap": 0.5 },
    },
  },
  {
    label: "🔥 Ember Camp — Day 2",
    day: "Day 2, 5pm",
    story: "80% today. 'Progress Shimmer' active on bars. 'Smooth Scroll' unlocked system-wide.",
    state: {
      dailyEnergy: 4, dailyEnergyTier: "blazing",
      streakPower: 1, streakPowerTier: "ember",
      todayHours: 5.2, todayLogCount: 6, todayTargetPercent: 80,
      weeklyHours: 14.9, streakDays: 2,
      todayByCategory: { "Project Building": 2.0, "Focused Practice": 1.8, "Daily Learning": 0.9, "Rapid Recap": 0.5 },
      weeklyByCategory: { "Project Building": 6, "Focused Practice": 5.5, "Daily Learning": 2.4, "Rapid Recap": 1.0 },
    },
  },

  // ── TIER 2: IRON FORGE ─────────────────────────────
  {
    label: "⚒️ Iron Forge — Unlocked",
    day: "Day 3, 5pm",
    story: "Three solid days! You step into the Forge. Card 'Slide-up' entrance unlocked.",
    state: {
      dailyEnergy: 4, dailyEnergyTier: "blazing",
      streakPower: 2, streakPowerTier: "campfire",
      todayHours: 5.0, todayLogCount: 6, todayTargetPercent: 77,
      weeklyHours: 22, streakDays: 3,
      todayByCategory: { "Project Building": 2.0, "Focused Practice": 1.8, "Daily Learning": 0.8, "Rapid Recap": 0.4 },
      weeklyByCategory: { "Project Building": 9, "Focused Practice": 8, "Daily Learning": 3.5, "Rapid Recap": 1.5 },
    },
  },
  {
    label: "⚒️ Iron Forge — Ripple Hover",
    day: "Day 4, 8pm",
    story: "Day 4 unlocks the metallic 'Ripple' hover effect.",
    state: {
      dailyEnergy: 5, dailyEnergyTier: "peak",
      streakPower: 2, streakPowerTier: "campfire",
      todayHours: 7.2, todayLogCount: 9, todayTargetPercent: 100,
      weeklyHours: 29, streakDays: 4,
      todayByCategory: { "Project Building": 2.5, "Focused Practice": 2.5, "Daily Learning": 1.2, "Rapid Recap": 1.0 },
      weeklyByCategory: { "Project Building": 11.5, "Focused Practice": 10.5, "Daily Learning": 4.5, "Rapid Recap": 2.5 },
    },
  },
  {
    label: "⚒️ Iron Forge — Hammer Sound",
    day: "Day 5, 2pm",
    story: "Day 5 unlocks the procedural 'Forge Hammer' sound on completing goals.",
    state: {
      dailyEnergy: 2, dailyEnergyTier: "warming",
      streakPower: 2, streakPowerTier: "campfire",
      todayHours: 1.5, todayLogCount: 2, todayTargetPercent: 25,
      weeklyHours: 30.5, streakDays: 5,
      todayByCategory: { "Project Building": 1.5 },
      weeklyByCategory: { "Project Building": 13, "Focused Practice": 10.5, "Daily Learning": 4.5, "Rapid Recap": 2.5 },
    },
  },

  // ── TIER 3: SKY CITADEL ────────────────────────────
  {
    label: "☁️ Sky Citadel — Ascended",
    day: "Day 7, 7pm",
    story: "Glass cards float down from above. You've earned this altitude.",
    state: {
      dailyEnergy: 5, dailyEnergyTier: "peak",
      streakPower: 3, streakPowerTier: "inferno",
      todayHours: 7.0, todayLogCount: 9, todayTargetPercent: 100,
      weeklyHours: 42, streakDays: 7,
      todayByCategory: { "Project Building": 2.5, "Focused Practice": 2.5, "Daily Learning": 1.0, "Rapid Recap": 1.0 },
      weeklyByCategory: { "Project Building": 15, "Focused Practice": 14, "Daily Learning": 7, "Rapid Recap": 6 },
    },
  },
  {
    label: "☁️ Sky Citadel — Wind Chimes",
    day: "Day 10, 6pm",
    story: "Day 10 unlocks 'Parallax BG' and procedural 'Wind Chime' audio feedback.",
    state: {
      dailyEnergy: 5, dailyEnergyTier: "peak",
      streakPower: 3, streakPowerTier: "inferno",
      todayHours: 6.5, todayLogCount: 8, todayTargetPercent: 100,
      weeklyHours: 38, streakDays: 10,
      todayByCategory: { "Project Building": 2.5, "Focused Practice": 2.5, "Daily Learning": 1.0, "Rapid Recap": 0.5 },
      weeklyByCategory: { "Project Building": 14, "Focused Practice": 14, "Daily Learning": 6, "Rapid Recap": 5 },
    },
  },

  // ── TIER 4: OBSIDIAN SANCTUM ───────────────────────
  {
    label: "👑 Obsidian Sanctum — Master",
    day: "Day 14, 8pm",
    story: "Zero motion. Cards enter via a 1200ms slow fade. You have mastered the grid.",
    state: {
      dailyEnergy: 5, dailyEnergyTier: "peak",
      streakPower: 4, streakPowerTier: "legendary",
      todayHours: 7.5, todayLogCount: 10, todayTargetPercent: 100,
      weeklyHours: 52, streakDays: 14,
      todayByCategory: { "Project Building": 2.5, "Focused Practice": 2.5, "Daily Learning": 1.5, "Rapid Recap": 1.0 },
      weeklyByCategory: { "Project Building": 18, "Focused Practice": 18, "Daily Learning": 8, "Rapid Recap": 8 },
    },
  },
  {
    label: "👑 Obsidian Sanctum — Deep Resonance",
    day: "Day 21, 7pm",
    story: "Day 21 unlocks 'Deep Resonance' audio. A heavy, warm low-end hum on task completion. This is absolute discipline.",
    state: {
      dailyEnergy: 5, dailyEnergyTier: "peak",
      streakPower: 4, streakPowerTier: "legendary",
      todayHours: 6.8, todayLogCount: 8, todayTargetPercent: 100,
      weeklyHours: 48, streakDays: 21,
      todayByCategory: { "Project Building": 2.5, "Focused Practice": 2.0, "Daily Learning": 1.3, "Rapid Recap": 1.0 },
      weeklyByCategory: { "Project Building": 17, "Focused Practice": 16, "Daily Learning": 8, "Rapid Recap": 7 },
    },
  },
];

/* ── Preview stat cards — uses world CardSkin ── */
function PreviewStatCards() {
  const { todayHours, weeklyHours, loading } = useMomentum();
  const { CardSkin, theme } = useWorld();

  const stats = [
    { label: "Today", value: `${todayHours.toFixed(2)}h`, icon: Clock, accent: todayHours >= 4 },
    { label: "This Week", value: `${weeklyHours.toFixed(2)}h`, icon: TrendingUp, accent: weeklyHours >= 20 },
  ];

  return (
    <>
      {stats.map((stat) => (
        <CardSkin key={stat.label} className="flex items-center gap-4">
          <div
            className="rounded-xl p-2.5"
            style={{
              background: stat.accent ? theme.accentGlow : theme.surfaceRaised,
              transition: "all 600ms ease",
            }}
          >
            <stat.icon
              className="h-5 w-5"
              style={{
                color: stat.accent ? theme.accent : theme.textMuted,
                transition: "color 600ms ease",
              }}
            />
          </div>
          <div>
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest" style={{ color: theme.textMuted }}>
              {stat.label}
            </p>
            <p className="text-2xl font-bold tracking-tight" style={{
              fontFamily: "var(--font-display)",
              color: stat.accent ? theme.accent : theme.textPrimary,
            }}>
              {loading ? "—" : stat.value}
            </p>
          </div>
        </CardSkin>
      ))}
      <MomentumFlame />
    </>
  );
}

/** Inner content that can access useWorld() */
function PreviewContent({ presets, activeIdx, setActiveIdx }: {
  presets: Preset[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
}) {
  const { skin, theme } = useWorld();
  const { microInteractions } = useMomentum();
  const preset = presets[activeIdx];

  // Map micro-interactions into displayable badges
  const unlocks = [
    { label: "Hover Lift", active: microInteractions.hoverLift },
    { label: "Hover Glow", active: microInteractions.hoverGlow },
    { label: "Hover Ripple", active: microInteractions.hoverRipple },
    { label: "Completion Pulse", active: microInteractions.completionPulse },
    { label: "Progress Shimmer", active: microInteractions.progressShimmer },
    { label: "Confetti", active: microInteractions.confetti },
    { label: "Smooth Scroll", active: microInteractions.smoothScroll },
    { label: "Parallax BG", active: microInteractions.parallaxBg },
    { label: `Entrance: ${microInteractions.cardEntrance}`, active: microInteractions.cardEntrance !== "none" },
    { label: `Sound: ${microInteractions.completionSound.replace("-", " ")}`, active: microInteractions.completionSound !== "none" },
    { label: `Float: ${microInteractions.badgeFloat}`, active: microInteractions.badgeFloat !== "none" },
  ];

  return (
    <div className="min-h-screen p-8 space-y-8 relative z-10">
      <div>
        <h1 className="text-2xl font-extrabold mb-1" style={{ fontFamily: "var(--font-display)", color: theme.textPrimary }}>
          Your Journey — World Skin Preview
        </h1>
        <p className="text-sm mb-1" style={{ color: theme.accent, fontFamily: "var(--font-body)", fontWeight: 600 }}>
          Current World: {skin.name}
        </p>
        <p className="text-sm mb-6" style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}>
          Tap a preset to see the full world transition — background, cards, and decorations.
        </p>

        {/* Timeline buttons */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className="rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300"
              style={{
                background: i === activeIdx ? theme.tabActiveBg : "transparent",
                color: i === activeIdx ? theme.tabActiveText : theme.tabText,
                border: "1px solid",
                borderColor: i === activeIdx ? theme.tabActiveBorder : theme.border,
                fontFamily: "var(--font-body)",
                transform: i === activeIdx ? "scale(1.03)" : "scale(1)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Story card */}
        <div
          className="mt-4 rounded-xl p-4 border"
          style={{
            background: theme.surface,
            borderColor: theme.border,
            borderRadius: theme.borderRadius,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: theme.accent, fontFamily: "var(--font-body)" }}>
            {preset.day}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: theme.textSecondary, fontFamily: "var(--font-body)" }}>
            {preset.story}
          </p>
        </div>

        {/* State badges (Data) */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {[
            ["Energy", `${preset.state.dailyEnergy}`],
            ["Streak", `${preset.state.streakDays}d`],
            ["Today", `${preset.state.todayHours}h`],
            ["Week", `${preset.state.weeklyHours}h`],
            ["Target", `${preset.state.todayTargetPercent}%`],
          ].map(([label, val]) => (
            <span
              key={label as string}
              className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: theme.surfaceRaised,
                color: theme.textMuted,
                fontFamily: "var(--font-body)",
              }}
            >
              <span style={{ color: theme.accent }}>{label}</span> {val as string}
            </span>
          ))}
        </div>

        {/* Unlocked Micro-interactions Badges */}
        <div className="mt-2 flex gap-1.5 flex-wrap items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: theme.textSecondary, fontFamily: "var(--font-body)" }}>Unlocks:</span>
          {unlocks.filter(u => u.active).map(u => (
            <span
              key={u.label}
              className={`${microInteractions.badgeFloat !== "none" ? `float-${microInteractions.badgeFloat}` : ""} rounded-md px-1.5 py-0.5 text-[9px] font-medium border`}
              style={{
                borderColor: theme.border,
                background: `${theme.accent}10`,
                color: theme.accent,
                fontFamily: "var(--font-body)",
              }}
            >
              ✨ {u.label}
            </span>
          ))}
          {unlocks.filter(u => u.active).length === 0 && (
            <span className="text-[10px] font-medium" style={{ color: theme.textMuted, fontFamily: "var(--font-body)" }}>None (Start tracking!)</span>
          )}
        </div>

        {/* Interactive Test Buttons */}
        {(microInteractions.completionSound !== "none" || microInteractions.confetti) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {microInteractions.completionSound !== "none" && (
              <button
                onClick={() => triggerSound(microInteractions.completionSound)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-all duration-200 hover:scale-[1.04] active:scale-95"
                style={{
                  borderColor: theme.accent,
                  color: theme.accent,
                  background: `${theme.accent}15`,
                  fontFamily: "var(--font-body)",
                }}
              >
                <Volume2 className="w-3.5 h-3.5" />
                Play: {microInteractions.completionSound.replace("-", " ")}
              </button>
            )}
            {microInteractions.confetti && (
              <button
                onClick={() => {
                  const colors = [theme.accent, theme.textPrimary];
                  const end = Date.now() + 2000;
                  (function frame() {
                    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
                    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
                    if (Date.now() < end) requestAnimationFrame(frame);
                  }());
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-all duration-200 hover:scale-[1.04] active:scale-95"
                style={{
                  borderColor: theme.accent,
                  color: theme.accent,
                  background: `${theme.accent}15`,
                  fontFamily: "var(--font-body)",
                }}
              >
                <PartyPopper className="w-3.5 h-3.5" />
                Fire Confetti
              </button>
            )}
          </div>
        )}
      </div>

      {/* Component preview */}
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <PreviewStatCards />
        </div>
        <DailyProgressV2 />
        <WeeklyProgressV2 />
      </div>
    </div>
  );
}

export default function MomentumPreviewPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const preset = PRESETS[activeIdx];

  return (
    <MomentumProvider logs={[]} loading={false} override={preset.state}>
      <WorldRenderer>
        <PreviewContent presets={PRESETS} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />
        <SoundManager />
        <CompletionCelebration />
      </WorldRenderer>
    </MomentumProvider>
  );
}
