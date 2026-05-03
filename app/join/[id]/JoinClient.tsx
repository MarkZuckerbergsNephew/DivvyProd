"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

export default function JoinClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function join() {
    if (!name.trim()) return;
    setError("");

    const { data, error: insertError } = await supabase
      .from("participants")
      .insert({
        name: name.trim(),
        session_id: sessionId,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error(insertError);
      setError("Failed to join.");
      return;
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("host_participant_id")
      .eq("id", sessionId)
      .single();

    if (!session?.host_participant_id) {
      await supabase
        .from("sessions")
        .update({ host_participant_id: data.id })
        .eq("id", sessionId);
    }

    router.push(`/session/${sessionId}?participant=${data.id}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-8">
      <motion.div
        className="w-full max-w-[420px] md:max-w-lg lg:max-w-xl rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm p-6 space-y-5 shadow-sm animate-idle-shimmer"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-semibold text-center text-slate-900">
          Join split
        </h1>

        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
        />

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          type="button"
          onClick={join}
          className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-base min-h-[48px] active:scale-[0.98] transition-transform hover:bg-slate-800"
        >
          Join
        </button>
      </motion.div>
    </main>
  );
}
