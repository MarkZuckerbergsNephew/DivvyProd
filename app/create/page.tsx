"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateJoinCode } from "@/lib/generateCode";
import { useState } from "react";
import { motion } from "framer-motion";

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createSession(type: "restaurant" | "general") {
    if (loading) return;
    setLoading(true);

    const joinCode = generateJoinCode();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        title: "New Split",
        split_type: type,
        join_code: joinCode,
      })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      setLoading(false);
      return;
    }

    router.push(`/join/${data.id}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 lg:py-12">
      <div className="w-full max-w-[420px] md:max-w-2xl lg:max-w-3xl mx-auto">
        <motion.h1
          className="text-2xl font-semibold text-slate-900 text-center mb-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          What are you splitting?
        </motion.h1>
        <p className="text-sm text-slate-500 text-center mb-6 md:mb-8">
          Choose the type that fits — we’ll show only what you need.
        </p>

        {/* Bento: Restaurant (tax + tip) vs General (items only) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <motion.button
            type="button"
            onClick={() => createSession("restaurant")}
            disabled={loading}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-left p-6 md:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm min-h-[120px] md:min-h-[140px] flex flex-col justify-center disabled:opacity-60 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md transition-all animate-idle-shimmer"
          >
            <span className="font-semibold text-slate-900 text-lg">Restaurant</span>
            <span className="text-sm text-slate-500 mt-1">
              Dinner out — add tax and tip to the bill
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => createSession("general")}
            disabled={loading}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="text-left p-6 md:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm min-h-[120px] md:min-h-[140px] flex flex-col justify-center disabled:opacity-60 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md transition-all animate-idle-shimmer"
          >
            <span className="font-semibold text-slate-900 text-lg">General</span>
            <span className="text-sm text-slate-500 mt-1">
              Trips, groceries, rent — add tax if needed, no tip
            </span>
          </motion.button>
        </div>
      </div>
    </main>
  );
}
