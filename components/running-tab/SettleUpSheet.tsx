"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticipantAvatar from "@/components/ParticipantAvatar";

export type DebtTx = { from: string; to: string; amount: number };

type Participant = {
  id: string;
  name: string;
  venmo_username: string | null;
  cashapp_username: string | null;
};

type Settlement = {
  id: string;
  from_participant_id: string;
  to_participant_id: string;
  amount: number;
  settled_at: string;
  note: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  debtTxs: DebtTx[];
  participants: Participant[];
  settlements: Settlement[];
  currentParticipantId: string | null;
  isHost: boolean;
  sessionTitle: string;
  onSettle: (tx: DebtTx) => Promise<void>;
};

export default function SettleUpSheet({
  isOpen,
  onClose,
  debtTxs,
  participants,
  settlements,
  currentParticipantId,
  isHost,
  sessionTitle,
  onSettle,
}: Props) {
  const [settledKeys, setSettledKeys] = useState<Set<string>>(new Set());
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  const allCleared = debtTxs.length > 0 && settledKeys.size >= debtTxs.length;

  useEffect(() => {
    if (isOpen) {
      setSettledKeys(new Set());
      setCelebrated(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (allCleared && !celebrated) {
      setCelebrated(true);
      import("canvas-confetti").then((m) => {
        m.default({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      });
    }
  }, [allCleared, celebrated]);

  function venmoLink(toId: string, amount: number) {
    const to = participants.find((p) => p.id === toId);
    const note = encodeURIComponent(`Divvy settle up - ${sessionTitle}`);
    const base = to?.venmo_username?.trim()
      ? `https://venmo.com/${encodeURIComponent(to.venmo_username.trim())}`
      : "https://venmo.com/";
    return `${base}?txn=pay&amount=${amount.toFixed(2)}&note=${note}`;
  }

  function cashAppLink(toId: string, amount: number) {
    const to = participants.find((p) => p.id === toId);
    if (!to?.cashapp_username?.trim()) return null;
    return `https://cash.app/$${encodeURIComponent(to.cashapp_username.trim())}/${amount.toFixed(2)}`;
  }

  async function handleSettle(tx: DebtTx) {
    const key = `${tx.from}-${tx.to}`;
    setSettlingKey(key);
    await onSettle(tx);
    setSettlingKey(null);
    setSettledKeys((prev) => new Set([...prev, key]));
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="bg-white w-full max-w-md rounded-t-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Sticky header */}
            <div className="px-6 pt-4 pb-3 border-b border-slate-100 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {allCleared
                      ? "You're all settled up! 🎉"
                      : `Here's how to clear all debts in ${debtTxs.length} payment${debtTxs.length !== 1 ? "s" : ""}`}
                  </h3>
                  {!allCleared && (
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">
                      Minimized transactions · tap to record payments
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-3">
              {allCleared ? (
                <div className="text-center py-10 space-y-3">
                  <p className="text-6xl">🎉</p>
                  <p className="text-xl font-bold text-slate-900">All debts cleared!</p>
                  <p className="text-sm text-[var(--text-muted)]">The group is fully settled up.</p>
                </div>
              ) : (
                debtTxs.map((tx, idx) => {
                  const fromP = participants.find((p) => p.id === tx.from);
                  const toP = participants.find((p) => p.id === tx.to);
                  if (!fromP || !toP) return null;

                  const key = `${tx.from}-${tx.to}`;
                  const isMyRow = tx.from === currentParticipantId;
                  const canAct = isMyRow || isHost;
                  const isSettling = settlingKey === key;
                  const isSettled = settledKeys.has(key);
                  const vLink = venmoLink(tx.to, tx.amount);
                  const cLink = cashAppLink(tx.to, tx.amount);

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 transition-all ${
                        isSettled ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
                      }`}
                    >
                      {/* Payer → Amount → Receiver */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ParticipantAvatar name={fromP.name} size="md" />
                          <span className="text-sm font-semibold text-slate-900 truncate max-w-[80px] sm:max-w-none">
                            {fromP.id === currentParticipantId ? "You" : fromP.name}
                          </span>
                        </div>

                        <div className="flex-1 flex items-center gap-1 min-w-[60px]">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="shrink-0 text-sm font-bold text-slate-900 tabular-nums bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                            ${tx.amount.toFixed(2)}
                          </span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-semibold text-slate-900 truncate max-w-[80px] sm:max-w-none">
                            {toP.id === currentParticipantId ? "You" : toP.name}
                          </span>
                          <ParticipantAvatar name={toP.name} size="md" />
                        </div>
                      </div>

                      {isSettled ? (
                        <div className="flex items-center justify-center gap-2 py-1">
                          <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">✓</span>
                          <span className="text-sm font-medium text-emerald-700">Payment recorded</span>
                        </div>
                      ) : canAct ? (
                        <div className="space-y-2">
                          {isMyRow && (
                            <a
                              href={vLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleSettle(tx)}
                              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] transition-colors"
                            >
                              Pay now with Venmo
                            </a>
                          )}
                          {isMyRow && cLink && (
                            <a
                              href={cLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full min-h-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
                            >
                              Pay with CashApp
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSettle(tx)}
                            disabled={isSettling}
                            className={`w-full min-h-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 ${
                              !isMyRow ? "bg-slate-50" : ""
                            }`}
                          >
                            {isSettling
                              ? "Recording…"
                              : isMyRow
                              ? "Mark as settled without Venmo"
                              : `Mark ${fromP.name} as paid`}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-center text-[var(--text-hint)] py-1">
                          Waiting for {fromP.name} to pay {toP.name}
                        </p>
                      )}
                    </div>
                  );
                })
              )}

              {/* Settlement history */}
              {settlements.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    className="w-full flex items-center justify-between py-2 text-sm font-medium text-[var(--text-muted)] hover:text-slate-700 transition-colors"
                  >
                    <span>Settlement history ({settlements.length})</span>
                    <span className={`transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  <AnimatePresence>
                    {showHistory && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1.5 pb-2">
                          {settlements.map((s) => {
                            const fp = participants.find((p) => p.id === s.from_participant_id);
                            const tp = participants.find((p) => p.id === s.to_participant_id);
                            return (
                              <div key={s.id} className="flex items-center gap-2 text-sm">
                                <span className="text-slate-700 flex-1 truncate">
                                  {fp?.name ?? "?"} → {tp?.name ?? "?"}: ${s.amount.toFixed(2)}
                                </span>
                                <span className="text-[11px] text-[var(--text-hint)] shrink-0">
                                  {new Date(s.settled_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full text-slate-500 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
