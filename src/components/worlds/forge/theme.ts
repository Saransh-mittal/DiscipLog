import type { WorldTheme } from "../types";

/* Iron Forge — pressure + output, not comfort.
   Darker than Ember. Harder edges. More friction.
   Feels like: heat + pressure, not cozy fireside. */
const theme: WorldTheme = {
  bg: "oklch(0.09 0.02 42)",                // ← darkest warm tier (was 0.11)
  surface: "oklch(0.13 0.018 42 / 92%)",    // ← darker (was 0.15)
  surfaceRaised: "oklch(0.17 0.022 44 / 88%)",
  border: "oklch(0.75 0.16 50 / 18%)",      // ← sharper, more visible (was 16%)
  borderRadius: "6px",                       // ← hardest corners in system (was 8px)
  shadow: "inset 0 1px 0 oklch(1 0 0 / 10%), 0 4px 16px oklch(0 0 0 / 55%)",
  shadowCard: "inset 0 1px 0 oklch(1 0 0 / 12%), 0 8px 32px oklch(0 0 0 / 60%)",
  textPrimary: "oklch(0.88 0.03 50)",        // ← normalized: not too bright
  textSecondary: "oklch(0.68 0.025 48)",
  textMuted: "oklch(0.48 0.02 45)",
  accent: "oklch(0.80 0.20 50)",             // ← pushed harder + more saturated
  accentGlow: "oklch(0.80 0.20 50 / 20%)",
  spacing: "1.25rem",                         // ← tight, compressed (pressure feel)
  headerBg: "oklch(0.07 0.012 42 / 94%)",   // ← darker
  headerBorder: "oklch(0.75 0.16 50 / 15%)",
  tabText: "oklch(0.48 0.025 48)",
  tabActiveText: "oklch(0.88 0.06 50)",
  tabActiveBg: "oklch(0.80 0.20 50 / 10%)",
  tabActiveBorder: "oklch(0.80 0.20 50 / 35%)",
};

export default theme;
