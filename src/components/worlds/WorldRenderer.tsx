"use client";

import { useMemo, useEffect, createContext, useContext, type ReactNode, type CSSProperties } from "react";
import { useMomentum } from "@/components/MomentumProvider";
import type { WorldSkin, WorldTheme } from "./types";

/* ── Import all world skins ── */
import basecampTheme from "./basecamp/theme";
import BasecampBackground from "./basecamp/Background";
import BasecampCard from "./basecamp/CardSkin";
import BasecampHeader from "./basecamp/HeaderSkin";

import emberTheme from "./ember/theme";
import EmberBackground from "./ember/Background";
import EmberCard from "./ember/CardSkin";
import EmberHeader from "./ember/HeaderSkin";

import forgeTheme from "./forge/theme";
import ForgeBackground from "./forge/Background";
import ForgeCard from "./forge/CardSkin";
import ForgeHeader from "./forge/HeaderSkin";

import skyTheme from "./sky/theme";
import SkyBackground from "./sky/Background";
import SkyCard from "./sky/CardSkin";
import SkyHeader from "./sky/HeaderSkin";

import celestialTheme from "./celestial/theme";
import CelestialBackground from "./celestial/Background";
import CelestialCard from "./celestial/CardSkin";
import CelestialHeader from "./celestial/HeaderSkin";

import LevelUpModal from "./LevelUpModal";

/* ── Skin registry ── */
const SKINS: Record<number, WorldSkin> = {
  0: { id: "basecamp",  name: "Basecamp",         theme: basecampTheme,  Background: BasecampBackground,  CardSkin: BasecampCard,  HeaderSkin: BasecampHeader },
  1: { id: "ember",     name: "Ember Camp",        theme: emberTheme,     Background: EmberBackground,     CardSkin: EmberCard,     HeaderSkin: EmberHeader },
  2: { id: "forge",     name: "Iron Forge",        theme: forgeTheme,     Background: ForgeBackground,     CardSkin: ForgeCard,     HeaderSkin: ForgeHeader },
  3: { id: "sky",       name: "Sky Citadel",       theme: skyTheme,       Background: SkyBackground,       CardSkin: SkyCard,       HeaderSkin: SkyHeader },
  4: { id: "celestial", name: "Obsidian Sanctum",  theme: celestialTheme, Background: CelestialBackground, CardSkin: CelestialCard, HeaderSkin: CelestialHeader },
};

/* ── CSS custom property mapping: theme key → --world-* var name ── */
const THEME_CSS_MAP: [keyof WorldTheme, string][] = [
  ["surface",        "--world-surface"],
  ["surfaceRaised",  "--world-surface-raised"],
  ["border",         "--world-border"],
  ["borderRadius",   "--world-border-radius"],
  ["shadow",         "--world-shadow"],
  ["shadowCard",     "--world-shadow-card"],
  ["textPrimary",    "--world-text-primary"],
  ["textSecondary",  "--world-text-secondary"],
  ["textMuted",      "--world-text-muted"],
  ["accent",         "--world-accent"],
  ["accentGlow",     "--world-accent-glow"],
  ["spacing",        "--world-spacing"],
  ["headerBg",       "--world-header-bg"],
  ["headerBorder",   "--world-header-border"],
  ["tabText",        "--world-tab-text"],
  ["tabActiveText",  "--world-tab-active-text"],
  ["tabActiveBg",    "--world-tab-active-bg"],
  ["tabActiveBorder","--world-tab-active-border"],
];

/* ── World context ── */
interface WorldContextValue {
  skin: WorldSkin;
  theme: WorldTheme;
  tier: number;
  CardSkin: React.ComponentType<{ children: ReactNode; className?: string; style?: CSSProperties }>;
}

const WorldContext = createContext<WorldContextValue | null>(null);

export function useWorld() {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error("useWorld must be used within a WorldRenderer");
  return ctx;
}

/* ── WorldRenderer ── */
interface WorldRendererProps {
  children: ReactNode;
  /** Optional tier override (for preview page) */
  tierOverride?: number;
}

export default function WorldRenderer({ children, tierOverride }: WorldRendererProps) {
  const { streakPower } = useMomentum();
  const tier = tierOverride ?? streakPower;

  const skin = SKINS[tier] ?? SKINS[0];

  const value = useMemo(() => ({
    skin,
    theme: skin.theme,
    tier,
    CardSkin: skin.CardSkin,
  }), [skin, tier]);

  /* Push world theme as CSS custom properties on :root
     so ANY component can use var(--world-surface) etc. */
  useEffect(() => {
    const root = document.documentElement;
    for (const [key, varName] of THEME_CSS_MAP) {
      root.style.setProperty(varName, skin.theme[key] ?? "");
    }
    // Optional gradient
    if (skin.theme.accentGradient) {
      root.style.setProperty("--world-accent-gradient", skin.theme.accentGradient);
    }
    return () => {
      for (const [, varName] of THEME_CSS_MAP) {
        root.style.removeProperty(varName);
      }
      root.style.removeProperty("--world-accent-gradient");
    };
  }, [skin]);

  const Background = skin.Background;

  return (
    <WorldContext.Provider value={value}>
      <Background />
      <LevelUpModal tier={tier} theme={skin.theme} />
      {children}
    </WorldContext.Provider>
  );
}
