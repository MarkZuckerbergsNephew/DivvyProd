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
    <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
            Participants
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {participants.map(p => (
                <div
                  key={p.id}
                  className={`w-9 h-9 rounded-full text-white text-xs font-semibold flex items-center justify-center border-2 border-white shadow-sm ${getAvatarColor(
                    p.id
                  )}`}
                  title={p.name}
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
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {onlineIds.length} online
          </span>
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            {paidIds.length} paid
          </span>
        </div>
      </div>
    </div>
  );
}
