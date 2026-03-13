import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 text-center bg-zinc-950 text-zinc-50 relative overflow-hidden">
      {/* Decorative background gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full point-events-none" />

      <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl mb-6 relative z-10">
        Discip<span className="text-indigo-400">Log</span>
      </h1>
      <p className="text-lg text-zinc-400 max-w-2xl mb-12 relative z-10">
        A highly robust, scalable, and cross-platform discipline-logging application. 
        Track your working hours smoothly using AI-powered voice-to-text.
      </p>
      
      <Link href="/dashboard" className="relative z-10 px-8 py-4 bg-indigo-500 text-white font-bold rounded-full hover:bg-indigo-400 transition-all text-lg shadow-xl shadow-indigo-500/20">
        Enter Dashboard
      </Link>
    </div>
  );
}
