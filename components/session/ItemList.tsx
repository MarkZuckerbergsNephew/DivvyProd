"use client";

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
  getRemainingAmount,
  setEditingClaim,
  setAmountInput,
  lastClaimedItem,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl p-10 text-center">
        <p className="text-4xl mb-2">🍔</p>
        <p className="font-medium">No items yet</p>
        <p className="text-gray-500 text-sm">
          Add the first item above
        </p>
      </div>
    );
  }

  return (
    <ul
      className={`bg-white rounded-xl shadow-sm divide-y transition-all ${
        focusSection === "items" ? "ring-2 ring-green-200" : ""
      }`}
    >
      {items.map(item => {
        const claimedByMe =
          participantId &&
          claims.some(
            c =>
              c.item_id === item.id && c.participant_id === participantId
          );

        const claimers = participants
          .map(p => {
            const claim = claims.find(
              c =>
                c.item_id === item.id && c.participant_id === p.id
            );
            if (!claim) return null;
            return claim;
          })
          .filter((c): c is Claim => c !== null);

        const isClaimed = claimers.length > 0;
        return (
          <li
            key={item.id}
            onClick={e => {
              if (claimingItemIds.has(item.id)) return;
              if ((e.target as HTMLElement).closest("button")) return;
              toggleClaim(item.id);
            }}
            className={`cursor-pointer transition-all duration-150 ${
              isClaimed ? "px-4 py-2 opacity-95" : "px-4 py-3"
            } ${
              claimingItemIds.has(item.id)
                ? "opacity-50 pointer-events-none"
                : claimedByMe
                  ? "bg-green-100 border-l-4 border-green-500"
                  : "hover:bg-gray-50"
            } ${
              lastClaimedItem === item.id
                ? "scale-[1.02] ring-2 ring-green-300"
                : ""
            }`}
          >
            <div className="flex justify-between">
              <span>{item.name}</span>
              <span>${Number(item.price ?? 0).toFixed(2)}</span>
            </div>

            {claimers.length > 0 && (
              <div className="mt-3 space-y-2">
                {claimers.map(c => {
                  const participant = participants.find(
                    p => p.id === c.participant_id
                  );
                  const isMe = c.participant_id === participantId;

                  return (
                    <div
                      key={c.id}
                      className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm">
                        {participant?.name}
                      </span>

                      {isMe ? (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const remaining =
                              getRemainingAmount(item.id);
                            setEditingClaim(c);
                            setAmountInput(
                              c.amount && c.amount > 0
                                ? String(c.amount)
                                : remaining.toFixed(2)
                            );
                          }}
                          className="border rounded-md px-3 py-1 text-sm font-medium bg-white"
                        >
                          ${(c.amount ?? 0).toFixed(2)}
                        </button>
                      ) : (
                        <span className="text-sm font-medium">
                          ${(c.amount ?? 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}

                {(() => {
                  const remaining = getRemainingAmount(item.id);
                  const safeRemaining = Math.max(0, remaining);
                  return (
                    <>
                      <div className="text-xs text-gray-500 mt-1">
                        Remaining ${safeRemaining.toFixed(2)}
                      </div>
                      {remaining > 0 && (
                        <div className="text-xs text-orange-600 mt-1">
                          ${safeRemaining.toFixed(2)} still unclaimed
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
