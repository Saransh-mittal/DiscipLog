"use client";

import { useSession } from "next-auth/react";
import Logger from "@/components/Logger";
import Calendar from "@/components/Calendar";

export default function DashboardPage() {
  return (
    <div className="space-y-12">
      <section className="text-center md:text-left mt-8">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-sm">
          Log your discipline
        </h1>
        <p className="text-zinc-400 max-w-xl text-lg leading-relaxed">
          Record your blocks naturally. The AI will categorize your time and calculate your performance automatically.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12 items-start">
        <Logger />
        <Calendar />
      </div>
    </div>
  );
}
