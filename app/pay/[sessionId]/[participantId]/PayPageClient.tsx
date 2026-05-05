"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { calculateTotals } from "@/lib/billMath";
import { motion, AnimatePresence } from "framer-motion";

type Participant = {
  id: string;
  name: string;
  venmo_username?: string | null;
  cashapp_username?: string | null;
};

function createVenmoLink(amount: number, venmoUsername?: string | null) {
  const params = `txn=pay&amount=${amount.toFixed(2)}&note=Divvy%20Split`;
  if (venmoUsername?.trim()) {
    return `https://venmo.com/${encodeURIComponent(venmoUsername.trim())}?${params}`;
  }
  return `https://venmo.com/?${params}`;
}

export default function PayPageClient({
  sessionId,
  participantId,
}: {
  sessionId: string;
  participantId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionTitle, setSessionTitle] = useState("Split");
  const [hostName, setHostName] = useState("");
  const [hostVenmo, setHostVenmo] = useState<string | null>(null);
  const [hostCashApp, setHostCashApp] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase
        .from("sessions")
        .select("host_participant_id, tax_amount, tip_amount, title")
        .eq("id", sessionId)
        .single();

      const { data: participants } = await supabase
        .from("participants")
        .select("id, name, venmo_username, cashapp_username")
        .eq("session_id", sessionId);

      const { data: items } = await supabase
        .from("items")
        .select("id, price")
        .eq("session_id", sessionId);

      const itemIds = (items ?? []).map((i: { id: string }) => i.id);
      let claimsFiltered: { item_id: string; participant_id: string; amount?: number }[] = [];
      if (itemIds.length > 0) {
        const { data: claimsData } = await supabase
          .from("claims")
          .select("item_id, participant_id, amount")
          .in("item_id", itemIds);
        claimsFiltered = claimsData ?? [];
      }

      const { data: payments } = await supabase
        .from("payments")
        .select("participant_id")
        .eq("session_id", sessionId);
      const paidIds = (payments ?? []).map(
        (p: { participant_id: string }) => p.participant_id
      );
      setMarked(paidIds.includes(participantId));

      if (!session?.host_participant_id || !participants?.length || !items) {
        setError("Session not found");
        setLoading(false);
        return;
      }

      if (session.title) setSessionTitle(session.title);

      const host = (participants as Participant[]).find(
        (p) => p.id === session.host_participant_id
      );
      if (!host) {
        setError("Session not found");
        setLoading(false);
        return;
      }

      const taxAmount = Number(session.tax_amount ?? 0);
      const tipAmount = Number(session.tip_amount ?? 0);
      const totals = calculateTotals(
        items,
        claimsFiltered,
        participants as { id: string }[],
        taxAmount,
        tipAmount
      );

      const owed = totals[participantId] ?? 0;
      if (owed <= 0) {
        setError("You don't owe anything for this split.");
        setLoading(false);
        return;
      }

      setHostName(host.name);
      setHostVenmo(host.venmo_username ?? null);
      setHostCashApp(host.cashapp_username ?? null);
      setAmount(owed);
      setLoading(false);
    }

    load();
  }, [sessionId, participantId]);

  async function markPaid() {
    setMarking(true);
    const { error: err } = await supabase.from("payments").upsert(
      { session_id: sessionId, participant_id: participantId },
      { onConflict: "session_id,participant_id" }
    );
    setMarking(false);
    if (!err) setMarked(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  if (error || amount == null) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-4">
        <div className="text-4xl">🤔</div>
        <p className="text-slate-700 font-medium">{error || "Something went wrong."}</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[var(--text-muted)] underline underline-offset-2"
        >
          Back to home
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-elevated)] overflow-hidden">
          {/* Amount hero */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-slate-100 bg-slate-50/60">
            <p className="text-sm font-medium text-[var(--text-muted)] mb-2">
              You owe {hostName}
            </p>
            <motion.p
              className="text-5xl font-bold text-slate-900 tabular-nums tracking-tight"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 24 }}
            >
              ${amount.toFixed(2)}
            </motion.p>
            <p className="text-xs text-[var(--text-hint)] mt-2">{sessionTitle}</p>
          </div>

          {/* Actions */}
          <div className="p-6 space-y-3">
            <AnimatePresence mode="wait">
              {marked ? (
                <motion.div
                  key="paid"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 350, damping: 26 }}
                  className="w-full min-h-[52px] rounded-xl bg-[var(--success-light)] border border-emerald-200 flex items-center justify-center gap-2 text-emerald-700 font-semibold"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs flex-shrink-0">✓</span>
                  Marked as paid
                </motion.div>
              ) : (
                <motion.div key="actions" className="space-y-3">
                  {/* Venmo */}
                  {hostVenmo?.trim() ? (
                    <a
                      href={createVenmoLink(amount, hostVenmo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white font-semibold text-base hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(13,148,136,0.25)]"
                    >
                      Pay ${amount.toFixed(2)} with Venmo
                    </a>
                  ) : (
                    <div className="w-full min-h-[52px] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-medium">
                      Host hasn&apos;t added Venmo yet
                    </div>
                  )}

                  {/* CashApp */}
                  {hostCashApp?.trim() && (
                    <a
                      href={`https://cash.app/$${encodeURIComponent(hostCashApp.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all"
                    >
                      Pay with CashApp
                    </a>
                  )}

                  {/* Mark as paid */}
                  <button
                    onClick={markPaid}
                    disabled={marking}
                    className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {marking ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                        Marking…
                      </>
                    ) : (
                      "Mark as paid"
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => router.push(`/session/${sessionId}?participant=${participantId}`)}
              className="w-full text-sm text-[var(--text-muted)] py-2 hover:text-slate-700 transition-colors"
            >
              Open full session
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
