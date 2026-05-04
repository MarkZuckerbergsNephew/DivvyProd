"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { generateJoinCode } from "@/lib/generateCode";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/useToast";

type Step = "mode" | "type";

/* ── Slide variants — step 2 slides in from right, back slides right out ── */
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 48 : -48,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -48 : 48,
    opacity: 0,
  }),
};

const slideTransition = {
  duration: 0.28,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
};

export default function CreatePage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("mode");
  const [dir, setDir] = useState(1);
  const [runningTabExpanded, setRunningTabExpanded] = useState(false);
  const [loading, setLoading] = useState<"restaurant" | "general" | "running_tab" | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user);
    });
  }, []);

  function goToStep(next: Step, direction: number) {
    setDir(direction);
    setStep(next);
  }

  async function createQuickSession(splitType: "restaurant" | "general") {
    if (loading) return;
    setLoading(splitType);

    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        title: "New Split",
        split_type: splitType,
        split_mode: "quick",
        join_code: joinCode,
      })
      .select()
      .single();

    if (error || !data) {
      setLoading(null);
      toast.error("Couldn't create session. Please try again.");
      return;
    }

    router.push(`/join/${data.id}`);
  }

  async function createRunningTabSession() {
    if (loading) return;
    setLoading("running_tab");

    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        title: "Running Tab",
        split_type: "general",
        split_mode: "running_tab",
        join_code: joinCode,
      })
      .select()
      .single();

    if (error || !data) {
      setLoading(null);
      toast.error("Couldn't create running tab. Please try again.");
      return;
    }

    router.push(`/join/${data.id}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <StepDot active={step === "mode"} done={step === "type"} label="Mode" />
          <div className={`h-px w-8 transition-colors duration-300 ${step === "type" ? "bg-[var(--accent)]" : "bg-slate-200"}`} />
          <StepDot active={step === "type"} done={false} label="Type" />
        </div>

        {/* Animated step panels */}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            {step === "mode" && (
              <motion.div
                key="mode"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
              >
                <StepMode
                  runningTabExpanded={runningTabExpanded}
                  setRunningTabExpanded={setRunningTabExpanded}
                  onSelectSingle={() => goToStep("type", 1)}
                  isSignedIn={isSignedIn}
                  onCreateRunningTab={createRunningTabSession}
                  runningTabLoading={loading === "running_tab"}
                />
              </motion.div>
            )}

            {step === "type" && (
              <motion.div
                key="type"
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
              >
                <StepType
                  loading={loading}
                  onBack={() => goToStep("mode", -1)}
                  onCreate={createQuickSession}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </main>
  );
}

/* ──────────────────────────────────────────
   Step dot indicator
────────────────────────────────────────── */

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
        active ? "bg-[var(--accent)] scale-125" : done ? "bg-[var(--accent)]" : "bg-slate-200"
      }`} />
      <span className={`text-[10px] font-medium transition-colors duration-200 ${
        active ? "text-[var(--accent)]" : done ? "text-[var(--accent)]" : "text-slate-400"
      }`}>{label}</span>
    </div>
  );
}

/* ──────────────────────────────────────────
   Step 1 — Choose mode
────────────────────────────────────────── */

function StepMode({
  runningTabExpanded,
  setRunningTabExpanded,
  onSelectSingle,
  isSignedIn,
  onCreateRunningTab,
  runningTabLoading,
}: {
  runningTabExpanded: boolean;
  setRunningTabExpanded: (v: boolean) => void;
  onSelectSingle: () => void;
  isSignedIn: boolean;
  onCreateRunningTab: () => void;
  runningTabLoading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          What are you splitting?
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Pick the style that fits your situation
        </p>
      </div>

      <div className="space-y-3">
        {/* Single Session card */}
        <motion.button
          type="button"
          onClick={onSelectSingle}
          whileTap={{ scale: 0.985 }}
          className="w-full text-left rounded-2xl border-2 border-slate-200 bg-white hover:border-[var(--accent)] hover:bg-[var(--accent-light)]/30 hover:shadow-[0_0_0_3px_rgba(13,148,136,0.08)] transition-all duration-150 shadow-[var(--shadow-card)] overflow-hidden group"
          style={{ minHeight: 140 }}
        >
          <div className="p-5 flex gap-4 items-start">
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0 group-hover:bg-[var(--accent)] transition-colors duration-150">
              <svg className="w-5 h-5 text-[var(--accent)] group-hover:text-white transition-colors duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-bold text-slate-900 text-base leading-tight">Split right now</p>
              <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-snug">
                One-time bill splitting. No account needed. Everyone joins with a link.
              </p>
              <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Instant · No account
              </span>
            </div>
          </div>
        </motion.button>

        {/* Running Tab card */}
        <div className={`rounded-2xl border-2 transition-all duration-200 shadow-[var(--shadow-card)] overflow-hidden ${
          runningTabExpanded
            ? "border-slate-300 bg-slate-50/60"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
          style={{ minHeight: 140 }}
        >
          {!runningTabExpanded ? (
            <motion.button
              type="button"
              onClick={() => isSignedIn ? onCreateRunningTab() : setRunningTabExpanded(true)}
              disabled={runningTabLoading}
              whileTap={{ scale: 0.985 }}
              className="w-full text-left p-5 flex gap-4 items-start h-full disabled:opacity-60"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150 ${runningTabLoading ? "bg-[var(--accent)]" : "bg-slate-100"}`}>
                {runningTabLoading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-slate-900 text-base leading-tight">Running Tab</p>
                  {!isSignedIn && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Free account
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Track shared expenses over time. Perfect for roommates and travel groups.
                </p>
                <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Ongoing · Persistent
                </span>
              </div>
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-sm">Free account required</p>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1 leading-snug">
                    Running Tabs stay open so your whole group can keep adding expenses anytime. Takes 30 seconds to set up.
                  </p>
                </div>
              </div>

              <motion.a
                href="/signup"
                whileTap={{ scale: 0.98 }}
                className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] transition-colors shadow-[0_2px_8px_rgba(13,148,136,0.25)]"
              >
                Create free account →
              </motion.a>

              <button
                type="button"
                onClick={() => setRunningTabExpanded(false)}
                className="w-full text-[var(--text-muted)] text-sm py-1 hover:text-slate-700 transition-colors"
              >
                Maybe later
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   Step 2 — Choose split type
────────────────────────────────────────── */

function StepType({
  loading,
  onBack,
  onCreate,
}: {
  loading: "restaurant" | "general" | "running_tab" | null;
  onBack: () => void;
  onCreate: (type: "restaurant" | "general") => void;
}) {
  const types = [
    {
      id: "restaurant" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "Restaurant or Bar",
      subtitle: "We'll help you split tax and tip proportionally based on what everyone ordered.",
      badge: "Tax & tip splitting",
    },
    {
      id: "general" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      title: "General Split",
      subtitle: "Split any shared expense — groceries, Airbnb, utilities, anything.",
      badge: "Any expense",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Back + heading */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-slate-300 hover:bg-slate-50 active:scale-95 transition-all shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
            What kind of split?
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Single session · choose a type</p>
        </div>
      </div>

      <div className="space-y-3">
        {types.map(({ id, icon, title, subtitle, badge }, i) => {
          const isLoading = loading === id;
          const isDisabled = !!loading;

          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => !isDisabled && onCreate(id)}
              whileTap={!isDisabled ? { scale: 0.985 } : {}}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.07 }}
              disabled={isDisabled}
              className={`w-full text-left rounded-2xl border-2 bg-white transition-all duration-150 shadow-[var(--shadow-card)] overflow-hidden ${
                isLoading
                  ? "border-[var(--accent)] bg-[var(--accent-light)]/30 shadow-[0_0_0_3px_rgba(13,148,136,0.12)]"
                  : isDisabled
                  ? "border-slate-100 opacity-60 cursor-not-allowed"
                  : "border-slate-200 hover:border-[var(--accent)] hover:bg-[var(--accent-light)]/20 hover:shadow-[0_0_0_3px_rgba(13,148,136,0.08)]"
              }`}
              style={{ minHeight: 140 }}
            >
              <div className="p-5 flex gap-4 items-start">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150 ${
                  isLoading
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--accent-light)] text-[var(--accent)]"
                }`}>
                  {isLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : icon}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-bold text-slate-900 text-base leading-tight">{title}</p>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-snug">
                    {subtitle}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">
                    {badge}
                  </span>
                </div>
                <svg className="w-4 h-4 text-slate-300 mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
