"use client";

import { icons } from "lucide-react";
import type { LucideProps } from "lucide-react";
export { ALLOWED_ICONS, type AllowedIcon } from "@/lib/icons";

interface DynamicIconProps extends Omit<LucideProps, "ref"> {
  name: string;
}

export default function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComponent = icons[name as keyof typeof icons];
  if (!IconComponent) {
    const Fallback = icons["Tag"];
    return <Fallback {...props} />;
  }
  return <IconComponent {...props} />;
}
