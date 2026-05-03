"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function joinSplit() {
    if (!code.trim()) return;
    setError("");

    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("join_code", code.trim().toUpperCase())
      .single();

    if (!data) {
      setError("Invalid code");
      return;
    }

    router.push(`/join/${data.id}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Desktop: asymmetric two-column — hero left, card right. Mobile: stacked centered. */}
      <div className="w-full max-w-[420px] md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-12 gap-10">
          {/* Left: hero text — on desktop takes ~half, not centered */}
          <motion.div
            className="flex-1 text-center lg:text-left space-y-4"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
              Divvy
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-md mx-auto lg:mx-0">
              Split bills with friends instantly. One code. Everyone in.
            </p>
          </motion.div>

          {/* Right: card — on desktop narrower, floats beside hero */}
          <motion.div
            className="flex-shrink-0 w-full max-w-md mx-auto lg:mx-0 lg:max-w-[380px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-sm p-6 sm:p-8 space-y-5 shadow-sm animate-idle-shimmer">
              <button
                type="button"
                onClick={() => router.push("/create")}
                className="w-full bg-slate-900 text-white py-3.5 px-4 rounded-xl font-semibold text-base active:scale-[0.98] transition-transform min-h-[52px] hover:bg-slate-800"
              >
                Start a split
              </button>

              <div className="relative flex items-center gap-3 text-sm text-slate-400">
                <span className="flex-1 h-px bg-slate-200" />
                or enter code
                <span className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && joinSplit()}
                  className="flex-1 min-h-[48px] px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
                <button
                  type="button"
                  onClick={joinSplit}
                  className="min-h-[48px] px-5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 active:scale-[0.98] transition-transform hover:bg-slate-50"
                >
                  Join
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
