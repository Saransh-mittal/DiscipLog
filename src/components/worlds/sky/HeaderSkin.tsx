"use client";

import { ReactNode } from "react";
import theme from "./theme";

/** Sky Citadel Header — translucent frosted glass header. */
export default function HeaderSkin({ children }: { children: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-50 border-b px-6 py-3 md:px-10"
      style={{
        background: theme.headerBg,
        borderColor: theme.headerBorder,
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        transition: "all 600ms ease",
      }}
    >
      {children}
    </header>
  );
}
