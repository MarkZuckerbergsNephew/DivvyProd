"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/useToast";

type SessionStatus = "loading" | "active" | "closed" | "not_found";

export default function JoinClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const toast = useToast();
  const supabaseBrowser = createSupabaseBrowserClient();

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [sessionTitle, setSessionTitle] = useState("Split");
  const [name, setName] = useState("");
  const [venmoInput, setVenmoInput] = useState("");
  const [cashAppInput, setCashAppInput] = useState("");
  const [showPaymentFields, setShowPaymentFields] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function init() {
      // 1. Fetch session — must include split_mode to gate auth check
      const { data, error } = await supabase
        .from("sessions")
        .select("status, title, split_mode")
        .eq("id", sessionId)
        .single();

      if (error || !data) {
        setSessionStatus("not_found");
        return;
      }

      if (data.title) setSessionTitle(data.title);

      const s = (data as { status?: string }).status ?? "active";
      if (s === "completed" || s === "reviewing") {
        setSessionStatus("closed");
        return;
      }

      // 2. Running Tab requires auth — check BEFORE rendering form or writing anything
      if ((data as { split_mode?: string }).split_mode === "running_tab") {
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (!user) {
          router.replace(`/login?next=/join/${sessionId}`);
          return;
        }
        // Signed in — pre-fill from profile
        const { data: profile } = await supabaseBrowser
          .from("profiles")
          .select("display_name, venmo_username, cashapp_username")
          .eq("id", user.id)
          .single();
        if (profile) {
          if (profile.display_name) setName(profile.display_name);
          if (profile.venmo_username) {
            setVenmoInput(profile.venmo_username);
            setShowPaymentFields(true);
          }
          if (profile.cashapp_username) {
            setCashAppInput(profile.cashapp_username);
            setShowPaymentFields(true);
          }
        }
      } else {
        // Quick split — auth optional, still try to pre-fill if signed in
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (user) {
          const { data: profile } = await supabaseBrowser
            .from("profiles")
            .select("display_name, venmo_username, cashapp_username")
            .eq("id", user.id)
            .single();
          if (profile) {
            if (profile.display_name) setName(profile.display_name);
            if (profile.venmo_username) {
              setVenmoInput(profile.venmo_username);
              setShowPaymentFields(true);
            }
            if (profile.cashapp_username) {
              setCashAppInput(profile.cashapp_username);
              setShowPaymentFields(true);
            }
          }
        }
      }

      setSessionStatus("active");
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function join() {
    if (!name.trim() || joining) return;

    // Defense in depth: re-verify session mode and auth before any INSERT
    const { data: sessionCheck } = await supabase
      .from("sessions")
      .select("split_mode")
      .eq("id", sessionId)
      .single();
    if ((sessionCheck as { split_mode?: string } | null)?.split_mode === "running_tab") {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) {
        router.replace(`/login?next=/join/${sessionId}`);
        return;
      }
    }

    setJoining(true);

    const { data: { user: currentUser } } = await supabaseBrowser.auth.getUser();

    const { data, error: insertError } = await supabase
      .from("participants")
      .insert({
        name: name.trim(),
        session_id: sessionId,
        venmo_username: venmoInput.trim() || null,
        cashapp_username: cashAppInput.trim() || null,
        user_id: currentUser?.id ?? null,
      })
      .select()
      .single();

    if (insertError || !data) {
      toast.error("Couldn't join. Please try again.");
      setJoining(false);
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

  /* ── Loading ── */
  if (sessionStatus === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 py-8">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  /* ── Not found ── */
  if (sessionStatus === "not_found") {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 py-8">
        <motion.div
          className="w-full max-w-sm text-center space-y-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="text-5xl">🔍</div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">Session not found</h1>
            <p className="text-sm text-[var(--text-muted)]">
              This link may be invalid or the session was removed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full min-h-[48px] bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            Go home
          </button>
        </motion.div>
      </main>
    );
  }

  /* ── Closed ── */
  if (sessionStatus === "closed") {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 py-8">
        <motion.div
          className="w-full max-w-sm text-center space-y-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="text-5xl">🔒</div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">This split has ended</h1>
            <p className="text-sm text-[var(--text-muted)]">
              &ldquo;{sessionTitle}&rdquo; is no longer accepting new participants.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/create")}
            className="w-full min-h-[48px] bg-[var(--accent)] text-white rounded-xl font-semibold hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all"
          >
            Start your own split
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full text-[var(--text-muted)] text-sm py-2"
          >
            Go home
          </button>
        </motion.div>
      </main>
    );
  }

  /* ── Active — join form ── */
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-elevated)] p-6 space-y-5">
          {/* Session title */}
          <div className="text-center space-y-1 pb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
              You&apos;re invited
            </p>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {sessionTitle !== "New Split" ? sessionTitle : "Join split"}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Enter your name to join</p>
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Your name</label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              autoFocus
              className="w-full min-h-[52px] px-4 rounded-xl border border-[var(--border)] bg-slate-50/50 text-base placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Payment info expander */}
          <div>
            <button
              type="button"
              onClick={() => setShowPaymentFields((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-slate-700 transition-colors"
            >
              <span
                className={`w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center transition-colors ${
                  showPaymentFields ? "bg-[var(--accent)] border-[var(--accent)] text-white" : ""
                }`}
              >
                {showPaymentFields ? (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </span>
              Add payment info
              <span className="text-xs text-[var(--text-hint)] font-normal">optional</span>
            </button>

            <AnimatePresence>
              {showPaymentFields && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Venmo username</label>
                      <input
                        type="text"
                        placeholder="@username"
                        value={venmoInput}
                        onChange={(e) => setVenmoInput(e.target.value)}
                        className="w-full min-h-[44px] px-4 rounded-xl border border-[var(--border)] bg-slate-50/50 text-sm placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">CashApp username</label>
                      <input
                        type="text"
                        placeholder="$username"
                        value={cashAppInput}
                        onChange={(e) => setCashAppInput(e.target.value)}
                        className="w-full min-h-[44px] px-4 rounded-xl border border-[var(--border)] bg-slate-50/50 text-sm placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                      />
                    </div>
                    <p className="text-xs text-[var(--text-hint)]">
                      Lets the host pay you back if they owe you money
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Join button */}
          <button
            type="button"
            onClick={join}
            disabled={joining || !name.trim()}
            className="w-full bg-[var(--accent)] text-white py-3.5 rounded-xl font-semibold text-base min-h-[52px] active:scale-[0.98] transition-all hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(13,148,136,0.25)] disabled:shadow-none flex items-center justify-center gap-2"
          >
            {joining ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Joining…
              </>
            ) : (
              "Join →"
            )}
          </button>
        </div>
      </motion.div>
    </main>
  );
}
