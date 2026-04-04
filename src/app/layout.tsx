import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import "./globals-v2.css";
import "./smart-recall.css";
import AuthProvider from "@/components/AuthProvider";
import { GlobalErrorBoundaryV2 } from "@/components/GlobalErrorBoundaryV2";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://disciplog.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "DiscipLog — AI-Powered Discipline Tracker",
    template: "%s | DiscipLog",
  },
  description:
    "The AI-powered discipline tracking system. Log your focus sessions with voice-to-text intelligence, build streaks, and visualize your expanding consistency.",
  keywords: [
    "discipline tracker",
    "focus logger",
    "productivity app",
    "AI coach",
    "habit tracker",
    "voice logging",
    "streak tracker",
    "time tracking",
    "focus timer",
    "daily planner",
  ],
  authors: [{ name: "DiscipLog" }],
  creator: "DiscipLog",
  publisher: "DiscipLog",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "DiscipLog",
    title: "DiscipLog — AI-Powered Discipline Tracker",
    description:
      "Log your focus sessions with voice-to-text intelligence, build streaks, and visualize your expanding consistency.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DiscipLog — AI-Powered Discipline Tracker",
    description:
      "Log your focus sessions with voice-to-text intelligence, build streaks, and visualize your expanding consistency.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>
          <ThemeProvider>
            <GlobalErrorBoundaryV2>
              {children}
            </GlobalErrorBoundaryV2>
          </ThemeProvider>
        </AuthProvider>
      </body>
      <GoogleAnalytics gaId="G-G63Y146LC5" />
    </html>
  );
}
