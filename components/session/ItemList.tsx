"use client";

import { motion } from "framer-motion";

type Item = {
  id: string;
  name: string;
  price: number | null;
};

type Claim = {
  id: string;
  item_id: string;
  participant_id: string;
  amount?: number;
};

type Participant = {
  id: string;
  name: string;
};

type Props = {
  items: Item[];
  claims: Claim[];
  participants: Participant[];
  participantId: string | null;
  claimingItemIds: Set<string>;
  focusSection: string;
  toggleClaim: (itemId: string) => void;
  claimRemaining: (itemId: string) => void;
  getRemainingAmount: (itemId: string) => number;
  setEditingClaim: (c: Claim | null) => void;
  setAmountInput: (v: string) => void;
  lastClaimedItem: string | null;
};

export default function ItemList({
  items,
  claims,
  participants,
  participantId,
  claimingItemIds,
  focusSection,
  toggleClaim,
  claimRemaining,
  getRemainingAmount,
  setEditingClaim,
  setAmountInput,
  lastClaimedItem,
}: Props) {
  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-xl p-12 text-center shadow-md"
      >
        <div className="text-5xl mb-4 opacity-80">🍽️</div>
        <p className="font-semibold text-slate-800 text-lg">No items yet</p>
        <p className="text-slate-500 text-sm mt-1">
          Add items above to start splitting the bill
        </p>
      </motion.div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const claimedByMe =
          participantId &&
          claims.some(
            (c) =>
              c.item_id === item.id && c.participant_id === participantId
          );

        const claimers = participants
          .map((p) => {
            const claim = claims.find(
              (c) => c.item_id === item.id && c.participant_id === p.id
            );
            if (!claim) return null;
            return { participant: p, claim };
          })
          .filter((x): x is { participant: Participant; claim: Claim } => x !== null);

        const isClaimed = claimers.length > 0;
        const remaining = getRemainingAmount(item.id);
        const justClaimed = lastClaimedItem === item.id;
        const isFullyClaimed = remaining <= 0 && isClaimed;
        const isBusy = claimingItemIds.has(item.id);

        return (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.2), type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => {
              if (isBusy) return;
              if ((e.target as HTMLElement).closest("button")) return;
              if (remaining > 0) {
                claimRemaining(item.id);
              } else {
                toggleClaim(item.id);
              }
            }}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              focusSection === "items"
                ? "ring-2 ring-teal-400/60 ring-offset-2 ring-offset-[var(--divvy-bg-base)]"
                : ""
            } ${
              isBusy
                ? "opacity-60 pointer-events-none"
                : "cursor-pointer active:scale-[0.99]"
            } ${
              claimedByMe
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white shadow-sm"
                : isFullyClaimed
                  ? "border-slate-200/80 bg-slate-50/50"
                  : "border-slate-200/80 bg-white/95 hover:border-slate-300/80 hover:shadow-sm"
            } ${justClaimed ? "ring-2 ring-emerald-400/50 ring-offset-2" : ""}`}
          >
            {/* Top row: name + price */}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex items-center gap-2">
                {isFullyClaimed && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">
                    ✓
                  </span>
                )}
                <span className="font-semibold text-slate-900 truncate">
                  {item.name}
                </span>
              </div>
              <span className="flex-shrink-0 text-base font-semibold text-slate-700 tabular-nums">
                ${Number(item.price ?? 0).toFixed(2)}
              </span>
            </div>

            {/* Claim CTA when there's remaining and not claimed by me */}
            {remaining > 0 && !claimedByMe && (
              <div className="px-4 pb-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/12 text-teal-700 px-3 py-1.5 text-sm font-medium">
                  <span>Tap to claim</span>
                  <span className="font-semibold tabular-nums">
                    ${remaining.toFixed(2)}
                  </span>
                </span>
              </div>
            )}

            {/* Claim breakdown */}
            {claimers.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40 space-y-2">
                {claimers.map(({ participant, claim }) => {
                  const isMe = participant.id === participantId;
                  const initial = participant.name.charAt(0).toUpperCase();

                  return (
                    <div
                      key={claim.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-medium flex items-center justify-center">
                          {initial}
                        </span>
                        <span className="text-sm text-slate-700 truncate">
                          {participant.name}
                          {isMe && (
                            <span className="text-slate-500 font-normal ml-1">
                              (you)
                            </span>
                          )}
                        </span>
                      </div>
                      {isMe ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClaim(claim);
                            setAmountInput(
                              claim.amount && claim.amount > 0
                                ? String(claim.amount)
                                : remaining > 0
                                  ? remaining.toFixed(2)
                                  : (item.price ?? 0).toFixed(2)
                            );
                          }}
                          className="flex-shrink-0 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 tabular-nums shadow-sm hover:border-teal-300 hover:bg-teal-50/50 transition-colors"
                        >
                          ${(claim.amount ?? 0).toFixed(2)}
                        </button>
                      ) : (
                        <span className="flex-shrink-0 text-sm font-semibold text-slate-600 tabular-nums">
                          ${(claim.amount ?? 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {remaining > 0 && (
                  <p className="text-xs text-amber-700/90 font-medium pt-0.5">
                    ${remaining.toFixed(2)} left to claim
                  </p>
                )}
              </div>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
