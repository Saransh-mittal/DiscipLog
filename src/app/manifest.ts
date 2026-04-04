import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DiscipLog — AI-Powered Discipline Tracker",
    short_name: "DiscipLog",
    description:
      "Log your focus sessions with voice-to-text intelligence, build streaks, and visualize your expanding consistency.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}
