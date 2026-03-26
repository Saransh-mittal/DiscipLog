"use client";

import { ReactNode } from "react";
import theme from "./theme";

/** Obsidian Sanctum Header — flat, solid, silent.
 *  No blur (solid, not glassy). Ghost border. Slowest transition. */
export default function HeaderSkin({ children }: { children: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-50 border-b px-8 py-4 md:px-12"
      style={{
        background: theme.headerBg,
        borderColor: theme.headerBorder,
        // deliberately NO backdrop-filter — solid, not glassy
        transition: "all 1200ms ease",
      }}
    >
      {children}
    </header>
  );
}
