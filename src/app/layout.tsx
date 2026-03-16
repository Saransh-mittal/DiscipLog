import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./globals-v2.css";
import AuthProvider from "@/components/AuthProvider";
import { GlobalErrorBoundaryV2 } from "@/components/GlobalErrorBoundaryV2";
import { ThemeProvider } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "DiscipLog",
  description: "Track your working hours efficiently.",
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
    </html>
  );
}
