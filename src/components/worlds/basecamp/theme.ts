import type { WorldTheme } from "../types";

const theme: WorldTheme = {
  bg: "oklch(0.13 0.005 260)",
  surface: "oklch(0.16 0.005 260 / 90%)",
  surfaceRaised: "oklch(0.19 0.005 260 / 85%)",
  border: "oklch(1 0 0 / 5%)",              // slightly more visible (was 4%)
  borderRadius: "12px",
  shadow: "0 1px 3px oklch(0 0 0 / 15%)",
  shadowCard: "0 2px 8px oklch(0 0 0 / 20%)",
  textPrimary: "oklch(0.82 0.008 260)",      // ← bumped from 0.72 — readable, not dull
  textSecondary: "oklch(0.62 0.008 260)",    // ← bumped from 0.55
  textMuted: "oklch(0.45 0.005 260)",        // ← bumped from 0.38
  accent: "oklch(0.60 0.06 260)",            // ← cool blue-gray accent (was 0.50/0.03 — too muted)
  accentGlow: "oklch(0.60 0.06 260 / 8%)",
  spacing: "1.25rem",
  headerBg: "oklch(0.11 0.005 260 / 95%)",
  headerBorder: "oklch(1 0 0 / 4%)",
  tabText: "oklch(0.45 0.008 260)",          // ← bumped from 0.38
  tabActiveText: "oklch(0.78 0.015 260)",    // ← bumped from 0.65
  tabActiveBg: "oklch(0.18 0.008 260 / 40%)",
  tabActiveBorder: "oklch(0.60 0.06 260 / 25%)",
};

export default theme;
