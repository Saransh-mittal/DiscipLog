// Curated whitelist of ~40 Lucide icons AI can suggest from.
// Kept in a shared lib so both server (API routes) and client (DynamicIcon) can import.

export const ALLOWED_ICONS = [
  "BookOpen", "Hammer", "GraduationCap", "Rocket", "Code",
  "Briefcase", "Dumbbell", "Heart", "Music", "Paintbrush",
  "PenTool", "Target", "Zap", "Brain", "Coffee",
  "Globe", "Laptop", "MessageSquare", "Users", "Video",
  "Camera", "Headphones", "Mic", "FileText", "BarChart",
  "Shield", "Star", "Trophy", "Lightbulb", "Compass",
  "Map", "Search", "Settings", "TrendingUp", "Wrench",
  "Flame", "Leaf", "Sun", "Moon", "Clock",
] as const;

export type AllowedIcon = (typeof ALLOWED_ICONS)[number];
