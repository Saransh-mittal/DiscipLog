"use client";

import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useCategoriesContext } from "@/components/CategoriesProvider";
import { computeMomentum, deriveMicroInteractions, type MomentumState } from "@/lib/momentum";
import type { DashboardLog } from "@/lib/logs";

const EMPTY_MOMENTUM: MomentumState = {
  dailyEnergy: 0,
  dailyEnergyTier: "cold",
  streakPower: 0,
  streakPowerTier: "dormant",
  todayHours: 0,
  todayByCategory: {},
  todayTargetPercent: 0,
  todayLogCount: 0,
  weeklyHours: 0,
  weeklyByCategory: {},
  streakDays: 0,
  microInteractions: {
    hoverLift: false, hoverGlow: false, hoverRipple: false,
    cardEntrance: "none",
    completionPulse: false, progressShimmer: false, confetti: false,
    smoothScroll: false, parallaxBg: false,
    completionSound: "none",
    badgeFloat: "none",
  },
};

interface MomentumContextValue extends MomentumState {
  loading: boolean;
}

const MomentumContext = createContext<MomentumContextValue>({
  ...EMPTY_MOMENTUM,
  loading: true,
});

export function useMomentum() {
  return useContext(MomentumContext);
}

/* ── Background gradients per world (Void → Ember → Forge → Ascent → Apex) ── */
const BG_GRADIENTS: Record<number, string> = {
  0: "oklch(0.10 0 0)", /* Void: flat featureless black */
  1: `radial-gradient(ellipse 100% 80% at 50% 100%, oklch(0.17 0.04 50) 0%, oklch(0.11 0.005 45) 100%)`, /* Ember: warm charcoal glow */
  2: `radial-gradient(ellipse 130% 110% at 50% 100%, oklch(0.22 0.08 45) 0%, oklch(0.14 0.03 45) 60%, oklch(0.10 0.01 40) 100%)`, /* Forge: rich amber environment */
  3: `radial-gradient(ellipse 140% 120% at 50% 60%, oklch(0.22 0.03 240) 0%, oklch(0.18 0.02 245) 50%, oklch(0.14 0.01 240) 100%)`, /* Ascent: cool silver-blue */
  4: `radial-gradient(ellipse 120% 100% at 50% 0%, oklch(0.94 0.008 250) 0%, oklch(0.96 0.005 250) 60%, oklch(0.97 0.004 250) 100%)`, /* Apex: snowy near-white */
};

interface MomentumProviderProps {
  logs: DashboardLog[];
  loading: boolean;
  children: ReactNode;
  override?: Partial<MomentumState>;
}

export default function MomentumProvider({
  logs,
  loading,
  children,
  override,
}: MomentumProviderProps) {
  const { categories, loading: catLoading } = useCategoriesContext();
  const isLoading = override ? false : loading || catLoading;

  const momentum = useMemo(() => {
    if (override) {
      const merged = { ...EMPTY_MOMENTUM, ...override };
      // Re-derive microInteractions from the overridden values (SSOT)
      merged.microInteractions = deriveMicroInteractions(
        merged.dailyEnergy,
        merged.streakPower,
        merged.streakDays
      );
      return merged;
    }
    return isLoading ? EMPTY_MOMENTUM : computeMomentum(logs, categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, categories, isLoading, JSON.stringify(override)]);

  const value = useMemo<MomentumContextValue>(
    () => ({ ...momentum, loading: isLoading }),
    [momentum, isLoading]
  );

  /* Push momentum data-attributes to <html> so CSS vars cascade globally
     (header, navbar, and all layout elements pick up tier styles) */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("momentum-root");
    root.setAttribute("data-streak-power", String(momentum.streakPower));
    root.setAttribute("data-daily-energy", String(momentum.dailyEnergy));
    return () => {
      root.classList.remove("momentum-root");
      root.removeAttribute("data-streak-power");
      root.removeAttribute("data-daily-energy");
    };
  }, [momentum.streakPower, momentum.dailyEnergy]);

  return (
    <MomentumContext.Provider value={value}>
      <div>
        {/* Fixed Background layers for cross-fading (1200ms for dramatic transitions) */}
        <div className="fixed inset-0 -z-50 pointer-events-none" aria-hidden="true">
          {Object.entries(BG_GRADIENTS).map(([tierStr, bg]) => {
            const tier = Number(tierStr);
            return (
              <div
                key={tier}
                className="absolute inset-0"
                style={{
                  background: bg,
                  opacity: momentum.streakPower === tier ? 1 : 0,
                  transition: 'opacity 1200ms ease-in-out',
                }}
              />
            );
          })}
        </div>
        {children}
      </div>
    </MomentumContext.Provider>
  );
}

