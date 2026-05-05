"use client";

import { getParticipantColor, getInitials } from "@/lib/participantColor";

type Participant = {
  id: string;
  name: string;
};

type Props = {
  participants: Participant[];
  onlineIds: string[];
  paidIds: string[];
  hostParticipantId: string | null;
  getAvatarColor?: (id: string) => string;
  isHost?: boolean;
  onEditPaymentInfo?: () => void;
};

export default function ParticipantList({
  participants,
  onlineIds,
  paidIds,
  hostParticipantId,
  isHost,
  onEditPaymentInfo,
}: Props) {
  if (participants.length === 0) return null;

  return (
    <div className="w-full min-w-0 rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {participants.length} {participants.length === 1 ? "person" : "people"}
        </p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            {onlineIds.length} online
          </span>
          {paidIds.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              ✓ {paidIds.length} paid
            </span>
          )}
        </div>
      </div>

      {/* Horizontal scrolling avatar row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {participants.map((p) => {
          const isOnline = onlineIds.includes(p.id);
          const isPaid = paidIds.includes(p.id);
          const isParticipantHost = p.id === hostParticipantId;
          const color = getParticipantColor(p.name);
          const initials = getInitials(p.name);

          return (
            <div
              key={p.id}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              title={`${p.name}${isParticipantHost ? " (host)" : ""}${isPaid ? " · paid" : ""}`}
            >
              {/* Avatar with badges */}
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white text-sm border-2 border-white shadow-md"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>

                {/* Online dot */}
                {isOnline && !isPaid && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-white" />
                )}

                {/* Paid checkmark badge */}
                {isPaid && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[8px] font-bold">
                    ✓
                  </span>
                )}

                {/* Host crown */}
                {isParticipantHost && (
                  <span className="absolute -top-1 -right-1 text-[10px] leading-none">
                    👑
                  </span>
                )}
              </div>

              {/* Name */}
              <span className="text-[10px] text-slate-600 font-medium max-w-[48px] truncate text-center leading-tight">
                {p.name.split(' ')[0]}
              </span>
            </div>
          );
        })}

        {/* Edit payment info button for host */}
        {isHost && onEditPaymentInfo && (
          <button
            type="button"
            onClick={onEditPaymentInfo}
            className="flex-shrink-0 flex flex-col items-center gap-1 ml-1"
            title="Edit payment info"
          >
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-teal-400 hover:text-teal-500 transition-colors">
              <span className="text-lg leading-none">$</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Venmo</span>
          </button>
        )}
      </div>
    </div>
  );
}
