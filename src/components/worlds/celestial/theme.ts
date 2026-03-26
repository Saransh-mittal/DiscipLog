import type { WorldTheme } from "../types";

/* Obsidian Sanctum — THE FINAL FORM.
   Gold is not a color. Gold is a material.
   Light catching a surface — brighter top, darker bottom.

   Gold hierarchy:
     strongest (0.82) → streak count, key completions — uses gradient
     medium   (0.78) → values, numbers
     faint    (0.32) → labels, edges, borders */
const theme: WorldTheme = {
  bg: "oklch(0.045 0.002 75)",
  surface: "oklch(0.075 0.003 72 / 98%)",
  surfaceRaised: "oklch(0.095 0.004 72 / 97%)",
  border: "oklch(0.50 0.06 75 / 5%)",
  borderRadius: "10px",
  shadow: "none",
  shadowCard: "none",
  textPrimary: "oklch(0.78 0.010 75)",
  textSecondary: "oklch(0.50 0.006 72)",
  textMuted: "oklch(0.32 0.004 72)",
  accent: "oklch(0.82 0.10 75)",
  accentGlow: "oklch(0.82 0.10 75 / 3%)",
  accentGradient: "linear-gradient(180deg, oklch(0.88 0.09 78), oklch(0.70 0.11 72))",  // ← material gold: light top → dark bottom
  spacing: "3.25rem",
  headerBg: "oklch(0.04 0.002 72 / 99%)",
  headerBorder: "oklch(0.50 0.06 75 / 3%)",
  tabText: "oklch(0.32 0.004 72)",
  tabActiveText: "oklch(0.70 0.020 75)",
  tabActiveBg: "transparent",
  tabActiveBorder: "oklch(0.65 0.07 75 / 6%)",
};

export default theme;
