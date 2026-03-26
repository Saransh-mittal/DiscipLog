"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorld } from "@/components/worlds/WorldRenderer";

export type DashboardTab = "overview" | "log" | "history" | "recall" | "settings" | "archive";

interface TabContextValue {
  activeTab: DashboardTab;
  setTab: (tab: DashboardTab) => void;
}

const TabContext = createContext<TabContextValue>({
  activeTab: "overview",
  setTab: () => {},
});

export function useActiveTab() {
  return useContext(TabContext);
}

function pathToTab(pathname: string): DashboardTab {
  if (pathname.startsWith("/dashboard/log")) return "log";
  if (pathname.startsWith("/dashboard/history")) return "history";
  if (pathname.startsWith("/dashboard/recall")) return "recall";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  if (pathname.startsWith("/dashboard/archive")) return "archive";
  return "overview";
}

function tabToPath(tab: DashboardTab): string {
  if (tab === "log") return "/dashboard/log";
  if (tab === "history") return "/dashboard/history";
  if (tab === "recall") return "/dashboard/recall";
  if (tab === "settings") return "/dashboard/settings";
  if (tab === "archive") return "/dashboard/archive";
  return "/dashboard";
}

function isMainTabRoute(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/log") ||
    pathname.startsWith("/dashboard/history") ||
    pathname.startsWith("/dashboard/recall") ||
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/archive")
  );
}

/** Provider for client-side tab state — zero server round-trips on tab switch. */
export function TabProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => pathToTab(pathname));

  // Sync tab when pathname changes (e.g. navigating back from Settings)
  useEffect(() => {
    if (isMainTabRoute(pathname)) {
      setActiveTab(pathToTab(pathname));
    }
  }, [pathname]);

  // Sync tab if user navigates via browser back/forward
  useEffect(() => {
    const onPopState = () => {
      setActiveTab(pathToTab(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setTab = useCallback((tab: DashboardTab) => {
    if (tab === activeTab && isMainTabRoute(window.location.pathname)) return;
    setActiveTab(tab);

    // If on a different route (e.g. Settings), use Next.js router to navigate back
    if (!isMainTabRoute(window.location.pathname)) {
      router.push(tabToPath(tab));
    } else {
      // Already on a main tab route — pure client-side pushState (instant)
      window.history.pushState(null, "", tabToPath(tab));
    }
  }, [activeTab, router]);

  return (
    <TabContext.Provider value={{ activeTab, setTab }}>
      {children}
    </TabContext.Provider>
  );
}

const BASE_TABS: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "log", label: "Log" },
  { id: "history", label: "History" },
  { id: "recall", label: "Recall" },
  { id: "settings", label: "Settings" },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const { activeTab, setTab } = useActiveTab();
  const [hasArchives, setHasArchives] = useState(false);

  useEffect(() => {
    fetch("/api/debriefs/history")
      .then((res) => { if (res.ok) return res.json(); return []; })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHasArchives(true);
        }
      })
      .catch((e) => console.error("Could not fetch archives status:", e));
  }, []);

  let theme;
  try {
    ({ theme } = useWorld());
  } catch {
    theme = null;
  }

  const onMainRoute = isMainTabRoute(pathname);

  const tabsToRender = hasArchives
    ? [...BASE_TABS, { id: "archive" as DashboardTab, label: "Archive" }]
    : BASE_TABS;

  const getStyle = (isActive: boolean) => ({
    fontFamily: "var(--font-display)",
    color: isActive
      ? (theme?.tabActiveText ?? "var(--world-tab-active-text, var(--v2-text-primary))")
      : (theme?.tabText ?? "var(--world-tab-text, var(--v2-text-muted))"),
    background: isActive
      ? (theme?.tabActiveBg ?? "var(--world-tab-active-bg, transparent)")
      : "transparent",
    borderBottom: isActive
      ? `2px solid ${theme?.tabActiveBorder ?? "var(--world-tab-active-border, currentColor)"}`
      : "2px solid transparent",
    transform: isActive ? "scale(1.02)" : "scale(1)",
  });

  return (
    <nav className="flex items-center gap-1">
      {tabsToRender.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id as DashboardTab)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
          style={getStyle(onMainRoute && activeTab === tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
