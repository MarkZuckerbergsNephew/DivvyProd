"use client";

import ParticipantAvatar from "@/components/ParticipantAvatar";

type Participant = { id: string; name: string };
type DebtTx = { from: string; to: string; amount: number };

type Props = {
  participants: Participant[];
  currentParticipantId: string | null;
  debtTxs: DebtTx[];
  onSettleUp: () => void;
};

export default function BalanceDashboard({
  participants,
  currentParticipantId,
  debtTxs,
  onSettleUp,
}: Props) {
  if (participants.length === 0 || !currentParticipantId) return null;

  const others = participants.filter((p) => p.id !== currentParticipantId);
  if (others.length === 0) return null;

  const myDebtsTo = debtTxs.filter((tx) => tx.from === currentParticipantId);
  const debtsFromOthers = debtTxs.filter((tx) => tx.to === currentParticipantId);

  const totalIOwe = myDebtsTo.reduce((sum, tx) => sum + tx.amount, 0);
  const totalOwedToMe = debtsFromOthers.reduce((sum, tx) => sum + tx.amount, 0);

  let summaryText: string;
  let summaryColor: string;

  if (totalIOwe > 0.005 && totalOwedToMe > 0.005) {
    summaryText = `You owe $${totalIOwe.toFixed(2)} · Owed $${totalOwedToMe.toFixed(2)}`;
    summaryColor = "text-slate-700";
  } else if (totalIOwe > 0.005) {
    summaryText = `You owe $${totalIOwe.toFixed(2)} total`;
    summaryColor = "text-red-600";
  } else if (totalOwedToMe > 0.005) {
    summaryText = `You're owed $${totalOwedToMe.toFixed(2)} total`;
    summaryColor = "text-emerald-600";
  } else {
    summaryText = "You're all settled up";
    summaryColor = "text-slate-500";
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-[var(--shadow-card)] overflow-hidden">
      {/* Summary header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <p className={`text-sm font-semibold ${summaryColor}`}>{summaryText}</p>
      </div>

      {/* Per-member rows */}
      <div className="divide-y divide-slate-50">
        {others.map((p) => {
          const txIOwe = myDebtsTo.find((tx) => tx.to === p.id);
          const txTheyOwe = debtsFromOthers.find((tx) => tx.from === p.id);
          const firstName = p.name.split(" ")[0];

          if (txIOwe) {
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <ParticipantAvatar name={p.name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                  <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
                    You owe ${txIOwe.amount.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onSettleUp}
                  className="shrink-0 min-h-[34px] px-3 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-dark)] transition-colors"
                >
                  Settle up
                </button>
              </div>
            );
          }

          if (txTheyOwe) {
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <ParticipantAvatar name={p.name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                  <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">
                    {firstName} owes you ${txTheyOwe.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <ParticipantAvatar name={p.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                <span className="text-xs text-slate-600 font-medium">{firstName} · Settled up ✓</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
