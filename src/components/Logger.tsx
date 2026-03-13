"use client";

import { useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Mic, Square, Loader2, Save } from "lucide-react";

export default function Logger() {
  const { isListening, transcript, setTranscript, startListening, stopListening, supported, resetTranscript } = useSpeechRecognition();
  const [category, setCategory] = useState("Building");
  const [hours, setHours] = useState("2");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [savedLog, setSavedLog] = useState<any>(null);

  const handleSave = async () => {
    if (!transcript.trim()) return;
    setIsSummarizing(true);
    try {
      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        body: JSON.stringify({ text: transcript, category }),
        headers: { "Content-Type": "application/json" }
      });
      const sumData = await sumRes.json();
      
      const res = await fetch("/api/logs", {
        method: "POST",
        body: JSON.stringify({ hours: Number(hours), category, rawTranscript: transcript, summary: sumData.summary }),
        headers: { "Content-Type": "application/json" },
      });
      
      if (res.ok) {
        setSavedLog(await res.json());
        resetTranscript();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save log.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group transition-all">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50" />
      
      <div className="flex flex-col md:flex-row gap-6 mb-8 mt-2">
        <div className="flex-1">
          <label className="text-xs font-extrabold text-zinc-500 uppercase tracking-widest mb-3 block">Category</label>
          <div className="relative">
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option>Interview Prep</option>
              <option>Building</option>
              <option>Learning</option>
              <option>Shipping</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div className="w-full md:w-32">
          <label className="text-xs font-extrabold text-zinc-500 uppercase tracking-widest mb-3 block">Hours</label>
          <input 
            type="number" 
            step="0.5"
            min="0"
            value={hours} 
            onChange={(e) => setHours(e.target.value)}
            className="w-full flex-1 bg-zinc-950 border border-white/10 rounded-xl p-4 text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="relative mb-8 mt-4">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={supported ? "Type your log here, or tap the microphone to dictate..." : "Type your log manually (Speech-to-Text unavailable)..."}
          className={`w-full h-48 bg-zinc-950 border ${isListening ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'border-white/10'} text-zinc-300 rounded-2xl p-6 pb-12 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none transition-all duration-300 ease-out leading-relaxed`}
        />
        {isListening && (
          <div className="absolute bottom-5 left-6 flex items-center gap-3">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-xs tracking-wider text-red-500 font-bold uppercase">Recording...</span>
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        {supported && (
          <button
            onClick={isListening ? stopListening : startListening}
            className={`flex-1 relative font-bold p-4 rounded-xl flex items-center justify-center gap-3 transition-all ${isListening ? 'bg-zinc-800/80 border border-white/10 text-white hover:bg-zinc-700' : 'bg-indigo-600 border border-indigo-500 text-white hover:bg-indigo-500 hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5'}`}
          >
            {isListening ? (
              <><Square className="w-5 h-5 fill-current" /> Stop Recording</>
            ) : (
              <><Mic className="w-5 h-5" /> Start Recording</>
            )}
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={!transcript || isSummarizing}
          className="flex-[0.5] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:bg-emerald-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          {isSummarizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSummarizing ? 'Saving...' : 'Save Log'}
        </button>
      </div>

      {savedLog && (
        <div className="mt-8 p-6 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <h4 className="text-emerald-400 font-bold mb-3 tracking-tight">Log Saved & Summarized!</h4>
          <ul className="text-sm text-zinc-300 space-y-2 list-disc list-inside">
             {savedLog.aiSummary?.split('\n').filter((l: string) => l.trim().length > 0).map((bullet: string, i: number) => (
                <li key={i} className="pl-1 leading-relaxed">{bullet.replace(/^-/,'').trim()}</li>
             ))}
          </ul>
        </div>
      )}
    </div>
  );
}
