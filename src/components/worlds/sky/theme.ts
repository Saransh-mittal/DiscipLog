import type { WorldTheme } from "../types";

const theme: WorldTheme = {
  bg: "oklch(0.20 0.025 235)",
  surface: "oklch(0.28 0.02 235 / 35%)",     // ← more transparent (was 40%)
  surfaceRaised: "oklch(0.34 0.025 238 / 30%)", // ← lighter, more transparent for depth
  border: "oklch(1 0 0 / 12%)",               // ← slightly brighter (was 10%)
  borderRadius: "18px",
  shadow: "inset 0 1px 0 oklch(1 0 0 / 10%), 0 12px 40px oklch(0 0 0 / 25%)",
  shadowCard: "inset 0 1px 0 oklch(1 0 0 / 12%), 0 16px 48px oklch(0 0 0 / 30%)",
  textPrimary: "oklch(0.95 0.01 235)",
  textSecondary: "oklch(0.75 0.015 238)",
  textMuted: "oklch(0.55 0.01 235)",
  accent: "oklch(0.78 0.08 235)",
  accentGlow: "oklch(0.78 0.08 235 / 18%)",
  spacing: "1.5rem",
  headerBg: "oklch(0.22 0.018 235 / 55%)",    // ← brighter, more transparent (depth)
  headerBorder: "oklch(1 0 0 / 10%)",
  tabText: "oklch(0.55 0.02 235)",
  tabActiveText: "oklch(0.95 0.04 235)",
  tabActiveBg: "oklch(0.38 0.025 238 / 25%)",
  tabActiveBorder: "oklch(0.78 0.08 235 / 25%)",
};

export default theme;
