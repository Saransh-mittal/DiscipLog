import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  robots: "noindex, nofollow",
};

export default function SigninLayout({ children }: { children: React.ReactNode }) {
  return children;
}
