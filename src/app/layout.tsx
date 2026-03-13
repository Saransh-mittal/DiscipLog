import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <AuthProvider>
          <GlobalErrorBoundary>
            {children}
          </GlobalErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
