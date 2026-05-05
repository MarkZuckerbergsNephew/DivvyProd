"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ParticipantAvatar from "@/components/ParticipantAvatar";
import ShareSheet from "@/components/ShareSheet";

type Participant = {
  id: string;
  name: string;
  venmo_username: string | null;
  cashapp_username: string | null;
};

type Props = {
  participants: Participant[];
  balances: Record<string, number>;
  hostParticipantId: string | null;
  currentParticipantId: string | null;
  isHost: boolean;
  sessionId: string;
  joinCode: string | null;
  onRemove: (participantId: string) => Promise<string | null>;
  onTransferHost: (participantId: string) => Promise<void>;
  onLeave: () => Promise<string | null>;
};

type ActionType = "remove" | "transfer" | "leave";

export default function MemberManagement({
  participants,
  balances,
  hostParticipantId,
  currentParticipantId,
  isHost,
  sessionId,
  joinCode,
  onRemove,
  onTransferHost,
  onLeave,
}: Props) {
  const [showShare, setShowShare] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Participant | null>(null);
  const [confirmType, setConfirmType] = useState<ActionType | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function openConfirm(p: Participant, type: ActionType) {
    setConfirmTarget(p);
    setConfirmType(type);
    setErrorMsg(null);
  }

  function closeConfirm() {
    setConfirmTarget(null);
    setConfirmType(null);
    setErrorMsg(null);
  }

  async function confirm() {
    if (!confirmTarget || !confirmType) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      if (confirmType === "transfer") {
        await onTransferHost(confirmTarget.id);
        closeConfirm();
      } else if (confirmType === "leave") {
        const err = await onLeave();
        if (err) { setErrorMsg(err); return; }
        closeConfirm();
      } else {
        const err = await onRemove(confirmTarget.id);
        if (err) { setErrorMsg(err); return; }
        closeConfirm();
      }
    } finally {
      setProcessing(false);
    }
  }

  const confirmTitle =
    confirmType === "remove"
      ? `Remove ${confirmTarget?.name}?`
      : confirmType === "transfer"
      ? `Transfer host to ${confirmTarget?.name}?`
      : "Leave this tab?";

  const confirmBody =
    confirmType === "remove"
      ? "Their claims and expenses will be removed. This cannot be undone."
      : confirmType === "transfer"
      ? `${confirmTarget?.name} will become the new host with full admin rights.`
      : "You'll lose host controls. Your balance will remain until settled.";

  const confirmLabel =
    confirmType === "remove"
      ? "Remove member"
      : confirmType === "transfer"
      ? "Transfer host"
      : "Leave tab";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          {participants.length} member{participants.length !== 1 ? "s" : ""}
        </h3>
        <button
          type="button"
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors min-h-[36px] px-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Invite members
        </button>
      </div>

      <div className="space-y-2">
        {participants.map((p) => {
          const isHostMember = p.id === hostParticipantId;
          const isMe = p.id === currentParticipantId;
          const bal = balances[p.id] ?? 0;
          const canRemove = isHost && !isMe && !isHostMember;
          const canTransfer = isHost && !isMe && !isHostMember;

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-3 py-3 shadow-[var(--shadow-card)]"
            >
              <ParticipantAvatar name={p.name} size="md" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">
                    {p.name}{isMe ? " (you)" : ""}
                  </span>
                  {isHostMember && (
                    <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                      👑 Host
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs font-medium mt-0.5 tabular-nums ${
                    bal > 0.005
                      ? "text-emerald-600"
                      : bal < -0.005
                      ? "text-red-500"
                      : "text-slate-600"
                  }`}
                >
                  {bal > 0.005
                    ? `+$${bal.toFixed(2)} owed to them`
                    : bal < -0.005
                    ? `-$${Math.abs(bal).toFixed(2)} they owe`
                    : "All settled"}
                </p>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                {canTransfer && (
                  <button
                    type="button"
                    onClick={() => openConfirm(p, "transfer")}
                    className="text-xs text-slate-500 hover:text-amber-600 transition-colors min-h-[32px] px-2 font-medium"
                  >
                    Make host
                  </button>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => openConfirm(p, "remove")}
                    className="text-xs text-slate-500 hover:text-red-500 transition-colors min-h-[32px] px-2 font-medium"
                  >
                    Remove
                  </button>
                )}
                {isMe && !isHostMember && (
                  <button
                    type="button"
                    onClick={() => openConfirm(p, "leave")}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors min-h-[32px] px-2 font-medium"
                  >
                    Leave
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation sheet */}
      <AnimatePresence>
        {confirmTarget && confirmType && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

              <div className="text-center space-y-2">
                <p className="text-4xl">{confirmType === "transfer" ? "👑" : "⚠️"}</p>
                <h3 className="text-lg font-semibold text-slate-900">{confirmTitle}</h3>
                <p className="text-sm text-[var(--text-muted)]">{confirmBody}</p>
                {errorMsg && (
                  <p className="text-sm text-red-600 font-medium bg-red-50 rounded-xl px-3 py-2">
                    {errorMsg}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={processing}
                  className={`w-full min-h-[52px] rounded-xl font-semibold text-base transition-all disabled:opacity-50 ${
                    confirmType === "transfer"
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  {processing ? "Processing…" : confirmLabel}
                </button>
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="w-full text-slate-500 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ShareSheet
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        sessionId={sessionId}
        joinCode={joinCode}
      />
    </div>
  );
}
