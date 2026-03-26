"use client";

import { ReactNode, CSSProperties } from "react";

/* ── Color + style tokens per world ── */
export interface WorldTheme {
  /* Background */
  bg: string;                 // body/page background (solid or gradient)

  /* Surfaces */
  surface: string;            // card background
  surfaceRaised: string;      // elevated card / hover
  border: string;             // card/element borders
  borderRadius: string;       // card corner radius

  /* Shadows */
  shadow: string;             // default shadow
  shadowCard: string;         // card-level shadow

  /* Typography */
  textPrimary: string;        // headings, bold values
  textSecondary: string;      // body text
  textMuted: string;          // labels, captions

  /* Accent */
  accent: string;             // primary accent color
  accentGlow: string;         // accent glow (for progress bars, badges)
  accentGradient?: string;    // optional material gradient for gold text (top-bright → bottom-dark)

  /* Spacing */
  spacing: string;            // card gap / internal padding

  /* Header */
  headerBg: string;
  headerBorder: string;

  /* Tabs */
  tabText: string;
  tabActiveText: string;
  tabActiveBg: string;
  tabActiveBorder: string;
}

/* ── World skin definition ── */
export interface WorldSkin {
  id: string;
  name: string;
  theme: WorldTheme;
  Background: React.ComponentType;
  CardSkin: React.ComponentType<{ children: ReactNode; className?: string; style?: CSSProperties }>;
  HeaderSkin: React.ComponentType<{ children: ReactNode }>;
}

/* ── Level-up message config ── */
export interface LevelUpConfig {
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
}

export const LEVEL_UP_MESSAGES: Record<number, LevelUpConfig> = {
  1: {
    title: "Ember Camp",
    subtitle: "The fire is lit",
    description: "Your first streak day! Welcome to Ember Camp — the warmth of consistency.",
    emoji: "🔥",
  },
  2: {
    title: "Iron Forge",
    subtitle: "Sparks fly",
    description: "3-day streak! You've entered the Iron Forge — where discipline becomes craft.",
    emoji: "⚒️",
  },
  3: {
    title: "Sky Citadel",
    subtitle: "Above the clouds",
    description: "7-day streak! Rise into the Sky Citadel — you've earned this altitude.",
    emoji: "☁️",
  },
  4: {
    title: "Obsidian Sanctum",
    subtitle: "Quiet mastery",
    description: "14-day streak! Enter the Obsidian Sanctum — gold leaf on dark stone. This is earned power.",
    emoji: "👑",
  },
};
