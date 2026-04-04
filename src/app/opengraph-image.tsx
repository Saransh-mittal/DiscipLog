import { ImageResponse } from "next/og";

export const alt = "DiscipLog — AI-Powered Discipline Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a0a0a 0%, #111118 40%, #0d0d14 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow - top */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "700px",
            height: "300px",
            borderRadius: "100%",
            background:
              "radial-gradient(ellipse at center, rgba(120, 140, 255, 0.12) 0%, transparent 70%)",
          }}
        />

        {/* Ambient glow - bottom */}
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            right: "15%",
            width: "400px",
            height: "200px",
            borderRadius: "100%",
            background:
              "radial-gradient(ellipse at center, rgba(200, 160, 80, 0.08) 0%, transparent 70%)",
          }}
        />

        {/* Flame icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "88px",
            height: "88px",
            borderRadius: "22px",
            background: "linear-gradient(135deg, #1a1a2e, #12121e)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginBottom: "32px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7888ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
        </div>

        {/* App name */}
        <div
          style={{
            display: "flex",
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-3px",
            lineHeight: 1,
            marginBottom: "20px",
          }}
        >
          <span style={{ color: "#e8e8f0" }}>Discip</span>
          <span style={{ color: "#7888ff" }}>Log</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: "22px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
            maxWidth: "600px",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          AI-Powered Discipline Tracking. Voice Logging. Streaks.
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            width: "100%",
            height: "3px",
            background:
              "linear-gradient(90deg, transparent 0%, #7888ff 30%, #c8a050 70%, transparent 100%)",
          }}
        />

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            display: "flex",
            fontSize: "14px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          disciplog.com
        </div>
      </div>
    ),
    { ...size }
  );
}
