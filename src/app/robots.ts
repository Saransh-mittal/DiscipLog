import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://disciplog.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/onboarding", "/signout"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
