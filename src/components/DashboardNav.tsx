"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/log", label: "Log" },
  { href: "/dashboard/history", label: "History" },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150"
            style={{
              fontFamily: "var(--font-display)",
              color: isActive ? "var(--v2-amber-400)" : "var(--v2-text-muted)",
              background: isActive ? "oklch(0.65 0.19 60 / 8%)" : "transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
