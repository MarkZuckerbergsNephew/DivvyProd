"use client";

type Participant = {
  id: string;
  name: string;
};

type Props = {
  participants: Participant[];
  onlineIds: string[];
  paidIds: string[];
  hostParticipantId: string | null;
  getAvatarColor: (id: string) => string;
};

export default function ParticipantList({
  participants,
  onlineIds,
  paidIds,
  hostParticipantId,
  getAvatarColor,
}: Props) {
  const host = participants.find(p => p.id === hostParticipantId);

  return (
    <div className="w-full min-w-0 rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl p-4 shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Participants
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {participants.map((p, i) => (
                <div
                  key={p.id}
                  className={`w-10 h-10 rounded-full text-white text-sm font-semibold flex items-center justify-center border-2 border-white shadow-md ring-2 ring-white/50 ${getAvatarColor(
                    p.id
                  )}`}
                  title={p.name}
                  style={{ zIndex: participants.length - i }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {participants.length} people here
              </p>
              {host && (
                <p className="text-xs text-gray-500">
                  Host: {host.name}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700">
            {onlineIds.length} online
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
            {paidIds.length} paid
          </span>
        </div>
      </div>
    </div>
  );
}
