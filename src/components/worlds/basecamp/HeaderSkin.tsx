"use client";

import { ReactNode } from "react";
import theme from "./theme";

/** Basecamp Header — clean dark header with subtle border. */
export default function HeaderSkin({ children }: { children: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-50 border-b px-6 py-3 md:px-10"
      style={{
        background: theme.headerBg,
        borderColor: theme.headerBorder,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        transition: "all 600ms ease",
      }}
    >
      {children}
    </header>
  );
}
