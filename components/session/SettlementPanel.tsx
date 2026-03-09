"use client";

import { useState } from "react";

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
  copyPaymentRequest,
  copyAllPaymentRequests,
  startReview,
}: Props) {
  const [showRequestPayments, setShowRequestPayments] = useState(false);

  if (settlements.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Settle Up</h2>

      <p className="text-sm text-gray-600">
        {paidCount} of {totalDebtors} people paid
      </p>

      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
        <div
          className="h-full bg-green-500 transition-all"
          style={{
            width: `${
              totalDebtors ? (paidCount / totalDebtors) * 100 : 0
            }%`,
          }}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {settlements.map((s, i) => {
          const viewerIsDebtor = participantId === s.fromId;

          return (
            <div
              key={i}
              className={`px-4 py-3 space-y-2 transition ${
                paidIds.includes(s.fromId) ? "bg-green-50" : ""
              }`}
            >
              <div className="flex justify-between">
                <span>
                  {viewerIsDebtor
                    ? `You owe ${s.to}`
                    : `${s.from} owes ${s.to}`}
                </span>
                <span className="font-semibold">
                  ${s.amount.toFixed(2)}
                </span>
              </div>

              {!paidIds.includes(s.fromId) &&
                (viewerIsDebtor || isHost) && (
                  <div className="flex flex-wrap gap-2">
                    {viewerIsDebtor && (
                      <a
                        href={createVenmoLink(s.amount, hostVenmoUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm"
                      >
                        Pay with Venmo
                      </a>
                    )}
                    <button
                      onClick={() => markPaid(s.fromId)}
                      className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm"
                    >
                      Mark as Paid
                    </button>
                    {(viewerIsDebtor || isHost) && (
                      <button
                        onClick={() => copyPaymentRequest(s.fromId, s.amount)}
                        className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-700"
                      >
                        Copy payment request
                      </button>
                    )}
                  </div>
                )}

              {paidIds.includes(s.fromId) && (
                <span className="text-green-700 text-sm font-medium">
                  ✓ Paid
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
            onClick={() => setShowRequestPayments(prev => !prev)}
            className="w-full py-2 text-sm text-gray-600 border rounded-lg"
          >
            {showRequestPayments ? "Hide" : "Request Payments"}
          </button>
          {showRequestPayments && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-left">
              <p className="text-xs text-gray-500 mb-2">
                Copy and send to each person:
              </p>
              {settlements.map((s, i) => (
                <div key={i} className="flex justify-between items-center gap-2">
                  <span className="text-sm">
                    {s.from} → ${s.amount.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyPaymentRequest(s.fromId, s.amount)}
                    className="text-xs text-blue-600 underline"
                  >
                    Copy
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={copyAllPaymentRequests}
                className="w-full mt-2 py-2 text-sm bg-gray-200 rounded-lg"
              >
                Copy all payment requests
              </button>
            </div>
          )}
        </div>
      )}

      {isHost && status === "active" && (
        <button
          onClick={startReview}
          disabled={paidCount !== totalDebtors}
          className={`w-full py-3 rounded-xl font-medium ${
            paidCount === totalDebtors
              ? "bg-black text-white"
              : "bg-gray-300 text-gray-600"
          }`}
        >
          Review Split
        </button>
      )}
    </div>
  );
}
