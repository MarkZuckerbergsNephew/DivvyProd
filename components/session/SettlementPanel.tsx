"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type SettlementRow = {
  fromId: string;
  from: string;
  toId: string;
  to: string;
  amount: number;
};

type Props = {
  settlements: SettlementRow[];
  paidIds: string[];
  paidCount: number;
  totalDebtors: number;
  isHost: boolean;
  status: string;
  participantId: string | null;
  sessionId: string;
  markPaid: (fromId: string) => void;
  createVenmoLink: (amount: number, venmoUsername?: string | null) => string;
  hostVenmoUsername?: string | null;
  hostCashAppUsername?: string | null;
  isCurrentUserHost?: boolean;
  onOpenPaymentEdit?: () => void;
  copyPaymentRequest: (fromId: string, amount: number) => void;
  copyAllPaymentRequests: () => void;
  startReview: () => void;
};

export default function SettlementPanel({
  settlements,
  paidIds,
  paidCount,
  totalDebtors,
  isHost,
  status,
  participantId,
  sessionId,
  markPaid,
  createVenmoLink,
  hostVenmoUsername,
  hostCashAppUsername,
  isCurrentUserHost,
  onOpenPaymentEdit,
  copyPaymentRequest,
  copyAllPaymentRequests,
  startReview,
}: Props) {
  const [showRequestPayments, setShowRequestPayments] = useState(false);

  if (settlements.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Settle up</h2>
        {isCurrentUserHost && hostVenmoUsername?.trim() && (
          <button
            type="button"
            onClick={onOpenPaymentEdit}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline shrink-0"
          >
            Edit payment info
          </button>
        )}
      </div>

      {isCurrentUserHost && !hostVenmoUsername?.trim() && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">⚠️</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Add your Venmo so people can pay you
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Without it, participants can&apos;t pay you directly from this page.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPaymentEdit}
            className="w-full min-h-[44px] bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all"
          >
            Set up payment info →
          </button>
        </div>
      )}

      <p className="text-sm text-slate-600">
        {paidCount} of {totalDebtors} {totalDebtors === 1 ? "person" : "people"} paid
      </p>

      <div className="w-full h-2.5 bg-slate-200/90 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
          initial={{ width: 0 }}
          animate={{
            width: `${totalDebtors ? (paidCount / totalDebtors) * 100 : 0}%`,
          }}
          transition={{ type: "spring", damping: 25 }}
          style={{ originX: 0 }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-md divide-y divide-slate-100 overflow-hidden">
        {settlements.map((s, i) => {
          const viewerIsDebtor = participantId === s.fromId;
          const isPaid = paidIds.includes(s.fromId);

          return (
            <div
              key={i}
              className={`px-4 py-3.5 space-y-3 transition-colors ${
                isPaid ? "bg-emerald-50/70" : "bg-white/50"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-700">
                  {viewerIsDebtor
                    ? `You owe ${s.to}`
                    : `${s.from} owes ${s.to}`}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  ${s.amount.toFixed(2)}
                </span>
              </div>

              {!isPaid && (viewerIsDebtor || isHost) && (
                <div className="flex flex-wrap gap-2">
                  {viewerIsDebtor && (
                    hostVenmoUsername?.trim() ? (
                      <a
                        href={createVenmoLink(s.amount, hostVenmoUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 active:scale-[0.98] transition-all"
                      >
                        Pay with Venmo
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl bg-slate-100 text-slate-400 text-sm font-medium cursor-not-allowed"
                      >
                        Host hasn&apos;t added Venmo yet
                      </button>
                    )
                  )}
                  {viewerIsDebtor && hostCashAppUsername?.trim() && (
                    <a
                      href={`https://cash.app/$${encodeURIComponent(hostCashAppUsername.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all"
                    >
                      Pay with CashApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => markPaid(s.fromId)}
                    className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all"
                  >
                    Mark as paid
                  </button>
                  {(viewerIsDebtor || isHost) && (
                    <button
                      type="button"
                      onClick={() => copyPaymentRequest(s.fromId, s.amount)}
                      className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all"
                    >
                      Copy payment link
                    </button>
                  )}
                </div>
              )}

              {isPaid && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">✓</span>
                  Paid
                </span>
              )}
            </div>
          );
        })}
      </div>

      {isHost && status === "active" && settlements.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowRequestPayments((prev) => !prev)}
            className="w-full py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {showRequestPayments ? "Hide" : "Request payments"}
          </button>
          {showRequestPayments && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Copy and send to each person
              </p>
              {settlements.map((s, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center gap-3 py-2"
                >
                  <span className="text-sm text-slate-700">
                    {s.from} → <span className="font-semibold tabular-nums">${s.amount.toFixed(2)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyPaymentRequest(s.fromId, s.amount)}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Copy
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={copyAllPaymentRequests}
                className="w-full py-2.5 text-sm font-semibold rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              >
                Copy all payment links
              </button>
            </div>
          )}
        </div>
      )}

      {isHost && status === "active" && (
        <button
          type="button"
          onClick={startReview}
          disabled={paidCount !== totalDebtors}
          className={`w-full min-h-[48px] py-3 rounded-xl font-semibold transition-all ${
            paidCount === totalDebtors
              ? "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]"
              : "bg-slate-200 text-slate-500 cursor-not-allowed"
          }`}
        >
          Review split
        </button>
      )}
    </div>
  );
}
