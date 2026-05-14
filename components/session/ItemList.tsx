"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getParticipantColor, getInitials } from "@/lib/participantColor";

type Item = {
  id: string;
  name: string;
  price: number | null;
  category?: string | null;
};

const CAT_MAP: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  food:          { emoji: "🍔", label: "Food",          color: "#F97316", bg: "#FFF7ED" },
  drinks:        { emoji: "🥤", label: "Drinks",        color: "#3B82F6", bg: "#EFF6FF" },
  dessert:       { emoji: "🍰", label: "Dessert",       color: "#EC4899", bg: "#FDF2F8" },
  transport:     { emoji: "🚗", label: "Transport",     color: "#3B82F6", bg: "#EFF6FF" },
  entertainment: { emoji: "🎬", label: "Entertainment", color: "#EC4899", bg: "#FDF2F8" },
  supplies:      { emoji: "🛒", label: "Supplies",      color: "#22C55E", bg: "#F0FDF4" },
  utilities:     { emoji: "💡", label: "Utilities",     color: "#F59E0B", bg: "#FFFBEB" },
  other:         { emoji: "📦", label: "Other",         color: "#6B7280", bg: "#F3F4F6" },
};

function ItemCategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const cat = CAT_MAP[category];
  if (!cat) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
      style={{ backgroundColor: cat.bg, color: cat.color }}
    >
      {cat.emoji} {cat.label}
    </span>
  );
}

type Claim = {
  id: string;
  item_id: string;
  participant_id: string;
  amount?: number;
  locked?: boolean;
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
  isHost: boolean;
  isActive: boolean;
  onSaveItem: (itemId: string, name: string, price: number) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
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
  isHost,
  isActive,
  onSaveItem,
  onDeleteItem,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState("");
  const [editPriceInput, setEditPriceInput] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const showKebab = isHost && isActive;

  function closeMenu() {
    setOpenMenuId(null);
    setMenuPosition(null);
  }

  useEffect(() => {
    if (!openMenuId) return;
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [openMenuId]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-[var(--shadow-card)]">
        <div className="text-5xl mb-4 opacity-80">🍽️</div>
        <p className="font-semibold text-slate-800 text-lg">No items yet</p>
        <p className="text-slate-500 text-sm mt-1">
          Add items above to start splitting the bill
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop closes menu */}
      {openMenuId && (
        <div className="fixed inset-0 z-40" onClick={closeMenu} />
      )}

      {/* Fixed dropdown */}
      {openMenuId && menuPosition && (
        <div
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-[var(--shadow-elevated)] min-w-[144px] overflow-hidden"
        >
          <button
            type="button"
            onClick={() => {
              const item = items.find((i) => i.id === openMenuId);
              if (item) {
                setEditNameInput(item.name);
                setEditPriceInput(String(item.price ?? ""));
                setEditingItemId(openMenuId);
              }
              closeMenu();
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Edit item
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmId(openMenuId);
              closeMenu();
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete item
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item, index) => {
          const isEditingThis = editingItemId === item.id;

          const claimedByMe =
            participantId &&
            claims.some(
              (c) => c.item_id === item.id && c.participant_id === participantId
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

          // Dominant claimant = highest amount claim
          const dominantClaimer = claimers.length > 0
            ? claimers.reduce((max, c) => (c.claim.amount ?? 0) > (max.claim.amount ?? 0) ? c : max, claimers[0])
            : null;
          const stripeColor = dominantClaimer
            ? getParticipantColor(dominantClaimer.participant.name)
            : '#e2e8f0';

          if (isEditingThis) {
            return (
              <li
                key={item.id}
                className="rounded-xl border border-teal-300 bg-white shadow-[var(--shadow-card)] overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-3">
                  <input
                    autoFocus
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingItemId(null);
                    }}
                    placeholder="Item name"
                    className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-sm"
                  />
                  <input
                    value={editPriceInput}
                    onChange={(e) => setEditPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingItemId(null);
                    }}
                    placeholder="$0.00"
                    className="w-20 min-h-[40px] px-2 rounded-lg border border-slate-200 text-center focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    disabled={savingItemId === item.id}
                    onClick={async () => {
                      const price = parseFloat(editPriceInput);
                      if (!editNameInput.trim() || isNaN(price) || price < 0) return;
                      setSavingItemId(item.id);
                      try {
                        await onSaveItem(item.id, editNameInput.trim(), price);
                        setEditingItemId(null);
                      } finally {
                        setSavingItemId(null);
                      }
                    }}
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-teal-500 text-white hover:bg-teal-600 active:scale-[0.95] transition-all disabled:opacity-50"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItemId(null)}
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-[0.95] transition-all"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          }

          return (
            <li
              key={item.id}
              onClick={(e) => {
                if (isBusy) return;
                if ((e.target as HTMLElement).closest("button")) return;
                if (remaining > 0) {
                  claimRemaining(item.id);
                } else {
                  toggleClaim(item.id);
                }
              }}
              className={`rounded-xl border bg-white transition-all duration-200 overflow-hidden shadow-[var(--shadow-card)] ${
                isBusy
                  ? "opacity-60 pointer-events-none"
                  : "cursor-pointer active:scale-[0.99] hover:shadow-[var(--shadow-elevated)]"
              } ${
                justClaimed ? "ring-2 ring-emerald-400/50 ring-offset-2" : ""
              } ${
                claimedByMe
                  ? "border-slate-200"
                  : "border-slate-200/80 hover:border-slate-300"
              }`}
            >
              {/* Colored left-edge stripe + content */}
              <div className="flex">
                {/* Left stripe */}
                <div
                  className="w-1.5 flex-shrink-0 rounded-l-xl transition-colors duration-300"
                  style={{ backgroundColor: isClaimed ? stripeColor : '#e2e8f0' }}
                />

                {/* Card content */}
                <div className="flex-1 min-w-0">
                  {/* Top row: name + price + kebab */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      {isFullyClaimed && (
                        <span
                          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                          style={{ backgroundColor: stripeColor }}
                        >
                          ✓
                        </span>
                      )}
                      <span className="text-[17px] font-bold text-slate-900 truncate">
                        {item.name}
                      </span>
                      <ItemCategoryBadge category={item.category} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[17px] font-bold text-[var(--accent)] tabular-nums">
                        ${Number(item.price ?? 0).toFixed(2)}
                      </span>
                      {showKebab && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === item.id) {
                              closeMenu();
                            } else {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setMenuPosition({
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              });
                              setOpenMenuId(item.id);
                            }
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 active:scale-[0.95] transition-all"
                        >
                          •••
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tap to claim — full-width pill button (click bubbles to card) */}
                  {remaining > 0 && !claimedByMe && (
                    <div className="px-4 pb-3">
                      <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white px-4 py-2.5 text-sm font-semibold shadow-[0_2px_8px_rgba(13,148,136,0.22)]">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Tap to claim</span>
                        <span className="font-bold tabular-nums">${remaining.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Claimer avatar chips + breakdown */}
                  {claimers.length > 0 && (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-2"
                      style={{ backgroundColor: isClaimed ? `${stripeColor}0d` : undefined }}
                    >
                      {/* Avatar chip row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {claimers.map(({ participant }) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm"
                            style={{ backgroundColor: getParticipantColor(participant.name) }}
                          >
                            <span>{getInitials(participant.name)}</span>
                            <span>{participant.name.split(' ')[0]}</span>
                          </div>
                        ))}
                      </div>

                      {/* Claim status badge */}
                      {remaining > 0.01 ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                          <span>⚠</span>
                          <span>${remaining.toFixed(2)} unclaimed</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                          <span>✓</span>
                          <span>Fully claimed</span>
                        </div>
                      )}

                      {/* Amount breakdown */}
                      <div className="space-y-1.5">
                        {claimers.map(({ participant, claim }) => {
                          const isMe = participant.id === participantId;
                          return (
                            <div
                              key={claim.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="flex-shrink-0 w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                                  style={{ backgroundColor: getParticipantColor(participant.name) }}
                                >
                                  {getInitials(participant.name)}
                                </div>
                                <span className="text-sm text-slate-700 truncate">
                                  {participant.name}
                                  {isMe && (
                                    <span className="text-slate-500 font-normal ml-1">(you)</span>
                                  )}
                                </span>
                              </div>
                              <span className="flex-shrink-0 flex items-center gap-1 text-sm font-semibold text-slate-600 tabular-nums">
                                {claim.locked && (
                                  <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                ${(claim.amount ?? 0).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Edit your share — visible only to the current user if they have a claim */}
                      {(() => {
                        const myClaimer = claimers.find(({ participant }) => participant.id === participantId);
                        if (!myClaimer) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingClaim(myClaimer.claim);
                              setAmountInput(
                                myClaimer.claim.amount && myClaimer.claim.amount > 0
                                  ? String(myClaimer.claim.amount)
                                  : remaining > 0
                                  ? remaining.toFixed(2)
                                  : (item.price ?? 0).toFixed(2),
                              );
                            }}
                            className="w-full min-h-[44px] flex items-center justify-center gap-2 text-sm font-bold text-[var(--accent)] hover:bg-teal-50 rounded-xl border border-teal-200 transition-colors"
                          >
                            Edit your share →
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Delete confirmation bottom sheet */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-center">Delete item?</h3>
            <p className="text-sm text-slate-500 text-center">
              &ldquo;{items.find((i) => i.id === deleteConfirmId)?.name}&rdquo; and all its claims will be removed.
            </p>
            <button
              type="button"
              disabled={deletingItemId === deleteConfirmId}
              onClick={async () => {
                setDeletingItemId(deleteConfirmId);
                try {
                  await onDeleteItem(deleteConfirmId);
                  setDeleteConfirmId(null);
                } finally {
                  setDeletingItemId(null);
                }
              }}
              className="w-full min-h-[48px] bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {deletingItemId === deleteConfirmId ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirmId(null)}
              className="w-full text-slate-500 py-2"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
}
