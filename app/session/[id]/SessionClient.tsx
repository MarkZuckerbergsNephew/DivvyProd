"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import SessionShell from "../../components/session/SessionShell";

/* ================= TYPES ================= */

type Item = {
  id: string;
  name: string;
  price: number | null;
};

type Claim = {
  id: string;
  item_id: string;
  participant_id: string;
};

type Participant = {
  id: string;
  name: string;
};

type SettlementRow = {
  fromId: string;
  from: string;
  toId: string;
  to: string;
  amount: number;
};

type Activity = {
  id: string;
  message: string;
};

/* ================= UTILITIES ================= */

function getAvatarColor(id: string) {
  const colors = [
    "bg-red-400",
    "bg-orange-400",
    "bg-amber-400",
    "bg-green-400",
    "bg-emerald-400",
    "bg-teal-400",
    "bg-sky-400",
    "bg-blue-400",
    "bg-indigo-400",
    "bg-purple-400",
    "bg-pink-400",
  ];

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/* ================= COMPONENT ================= */

export default function SessionClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ================= STATE ================= */
  
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<string[]>([]);

  const [hostParticipantId, setHostParticipantId] =
    useState<string | null>(null);

  const [sessionTitle, setSessionTitle] = useState("Divvy Split");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [sharing, setSharing] = useState(false);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  const [activities, setActivities] = useState<Activity[]>([]);
  const prevClaimsRef = useRef<Claim[]>([]);

  const itemInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(sessionTitle);

  const [lastClaimedItem, setLastClaimedItem] =
    useState<string | null>(null);

  /* ================= INVITE ================= */

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${sessionId}`
      : "";

  async function shareInvite() {
    if (!navigator.share || sharing) return;

    try {
      setSharing(true);
      await navigator.share({
        title: "Join my Divvy split",
        text: "Join our bill split on Divvy!",
        url: inviteLink,
      });
    } finally {
      setSharing(false);
    }
  }

  /* ================= PARTICIPANT ================= */

  useEffect(() => {
    setParticipantId(searchParams.get("participant"));
  }, [searchParams]);

  useEffect(() => {
    if (!participantId) return;

    supabase
      .from("participants")
      .select("name")
      .eq("id", participantId)
      .single()
      .then(({ data }) => {
        if (data) setParticipantName(data.name);
      });
  }, [participantId]);

  /* ================= FETCHERS ================= */

  async function fetchSession() {
    const { data } = await supabase
      .from("sessions")
      .select("title, host_participant_id")
      .eq("id", sessionId)
      .single();

    if (!data) return;

    setHostParticipantId(data.host_participant_id);
    if (data.title) setSessionTitle(data.title);
  }

  async function fetchItems() {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("session_id", sessionId);

    setItems(data ?? []);
  }

  async function fetchParticipants() {
    const { data } = await supabase
      .from("participants")
      .select("id,name")
      .eq("session_id", sessionId);

    setParticipants(data ?? []);
  }

  async function fetchClaims() {
    const { data } = await supabase
      .from("claims")
      .select(`
        id,
        item_id,
        participant_id,
        items!inner(session_id)
      `)
      .eq("items.session_id", sessionId);

    setClaims(data ?? []);
  }

  useEffect(() => {
    fetchSession();
    fetchItems();
    fetchClaims();
    fetchParticipants();
  }, [sessionId]);

  useEffect(() => {
    setTitleInput(sessionTitle);
  }, [sessionTitle]);

  useEffect(() => {
    if (items.length === 0) {
      itemInputRef.current?.focus();
    }
  }, [items.length]);

  /* ================= REALTIME ================= */

  useEffect(() => {
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `session_id=eq.${sessionId}` },
        fetchItems
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        fetchClaims
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
        fetchParticipants
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  /* ================= PRESENCE ================= */

  useEffect(() => {
    if (!participantId || !participantName) return;

    const channel = supabase.channel(`presence-${sessionId}`, {
      config: { presence: { key: participantId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineIds(Object.keys(state));
    });

    channel.subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          participantId,
          name: participantName,
        });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [participantId, participantName, sessionId]);

  /* ================= PAYMENT REALTIME ================= */

  useEffect(() => {
    const channel = supabase.channel(`payments-${sessionId}`);

    channel.on("broadcast", { event: "paid" }, payload => {
      const paidParticipantId = payload.payload.participantId;

      setPaidIds(prev =>
        prev.includes(paidParticipantId)
          ? prev
          : [...prev, paidParticipantId]
      );
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  /* ================= ACTIVITY ================= */

  useEffect(() => {
    const prev = prevClaimsRef.current;

    const newClaims = claims.filter(
      c => !prev.some(p => p.id === c.id)
    );

    newClaims.forEach(claim => {
      const user = participants.find(p => p.id === claim.participant_id);
      const item = items.find(i => i.id === claim.item_id);

      if (!user || !item) return;

      const activity: Activity = {
        id: crypto.randomUUID(),
        message: `${user.name} claimed ${item.name}`,
      };

      setActivities(a => [activity, ...a.slice(0, 2)]);

      setTimeout(() => {
        setActivities(a => a.filter(x => x.id !== activity.id));
      }, 2500);
    });

    prevClaimsRef.current = claims;
  }, [claims, participants, items]);

  /* ================= CLAIM ================= */

  async function toggleClaim(itemId: string) {
    if (!participantId) return;

    const existing = claims.find(
      c =>
        c.item_id === itemId &&
        c.participant_id === participantId
    );

    if (existing) {
      await supabase.from("claims").delete().eq("id", existing.id);
    } else {
      await supabase.from("claims").insert({
        item_id: itemId,
        participant_id: participantId,
      });

      setLastClaimedItem(itemId);

      setTimeout(() => {
        setLastClaimedItem(null);
      }, 900);
    }
  }

  /* ================= ADD ITEM ================= */

  async function addItem() {
    const numericPrice = Number(price);
    if (!name.trim() || isNaN(numericPrice)) return;

    await supabase.from("items").insert({
      session_id: sessionId,
      name: name.trim(),
      price: numericPrice,
    });

    setName("");
    setPrice("");
    itemInputRef.current?.focus();
  }

  async function updateSessionTitle() {
    if (!titleInput.trim()) return;

    await supabase
      .from("sessions")
      .update({ title: titleInput.trim() })
      .eq("id", sessionId);

    setSessionTitle(titleInput.trim());
    setEditingTitle(false);
  }

  /* ================= MARK PAID ================= */

  async function markPaid(participantId: string) {
    // update local immediately (optimistic UI)
    setPaidIds(prev =>
      prev.includes(participantId)
        ? prev
        : [...prev, participantId]
    );

    // broadcast to everyone else
    const channel = supabase.channel(`payments-${sessionId}`);

    await channel.subscribe();

    await channel.send({
      type: "broadcast",
      event: "paid",
      payload: { participantId },
    });
  }

  /* ⭐ NEW — BILL SUMMARY */

  const billSummary = useMemo(() => {
    const total = items.reduce(
      (sum, i) => sum + Number(i.price ?? 0),
      0
    );

    const claimedItems = new Set(claims.map(c => c.item_id));

    const claimedTotal = items
      .filter(i => claimedItems.has(i.id))
      .reduce((s, i) => s + Number(i.price ?? 0), 0);

    return {
      total,
      claimedTotal,
      remaining: total - claimedTotal,
    };
  }, [items, claims]);

  const splitProgress = useMemo(() => {
    if (!items.length) {
      return {
        percent: 0,
        unclaimedCount: 0,
        allClaimed: false,
      };
    }
  
    // items that have at least one claim
    const claimedItemIds = new Set(claims.map(c => c.item_id));
  
    const claimedCount = items.filter(i =>
      claimedItemIds.has(i.id)
    ).length;
  
    const unclaimedCount = items.length - claimedCount;
  
    const percent = Math.round(
      (claimedCount / items.length) * 100
    );
  
    return {
      percent,
      unclaimedCount,
      allClaimed: unclaimedCount === 0,
    };
  }, [items, claims]);

  /* ================= TOTALS ================= */

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    participants.forEach(p => (t[p.id] = 0));

    items.forEach(item => {
      const claimers = claims.filter(c => c.item_id === item.id);
      if (!claimers.length) return;

      const split = Number(item.price ?? 0) / claimers.length;
      claimers.forEach(c => (t[c.participant_id] += split));
    });

    return t;
  }, [items, claims, participants]);

  /* ================= SETTLEMENT ================= */

  const settlements: SettlementRow[] = useMemo(() => {
    if (!hostParticipantId) return [];

    const host = participants.find(p => p.id === hostParticipantId);
    if (!host) return [];

    return participants
      .filter(p => p.id !== hostParticipantId)
      .filter(p => totals[p.id] > 0)
      .map(p => ({
        fromId: p.id,
        from: p.name,
        toId: host.id,
        to: host.name,
        amount: totals[p.id],
      }))
      .sort((a, b) => {
        const aPaid = paidIds.includes(a.fromId);
        const bPaid = paidIds.includes(b.fromId);

        if (aPaid === bPaid) return 0;
        return aPaid ? 1 : -1; // unpaid first
      });
  }, [participants, totals, hostParticipantId, paidIds]);

  function createVenmoLink(amount: number) {
    return `https://venmo.com/?txn=pay&amount=${amount.toFixed(
      2
    )}&note=Divvy%20Split`;
  }

  const isHost = participantId === hostParticipantId;

  function finishSplit() {
    router.push(`/summary/${sessionId}`);
  }

  /* ================= PAYMENT PROGRESS ================= */

  const totalDebtors = settlements.length;

  const paidCount = settlements.filter(s =>
    paidIds.includes(s.fromId)
  ).length;

  const sessionStage =
    items.length === 0
      ? "Adding items"
      : !splitProgress.allClaimed
      ? "Claiming items"
      : paidCount !== totalDebtors
      ? "Settling payments"
      : "Complete";

  const focusSection =
    sessionStage === "Adding items"
      ? "input"
      : sessionStage === "Claiming items"
      ? "items"
      : sessionStage === "Settling payments"
      ? "payment"
      : "complete";

  const viewerSettlement = settlements.find(
    s => s.fromId === participantId
  );

  const viewerOwesMoney = !!viewerSettlement;

  const viewerIsDone =
    !viewerOwesMoney ||
    paidIds.includes(participantId ?? "");

  const personalCard = (() => {
    if (!participantId) return null;

    // viewer owes money
    if (viewerOwesMoney && !viewerIsDone) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          <p className="text-sm text-green-800">
            You owe {viewerSettlement!.to}
          </p>

          <p className="text-2xl font-semibold text-green-900">
            ${viewerSettlement!.amount.toFixed(2)}
          </p>

          <a
            href={createVenmoLink(viewerSettlement!.amount)}
            target="_blank"
            className="block text-center bg-green-600 text-white py-2.5 rounded-lg font-medium"
          >
            Pay now
          </a>
        </div>
      );
    }

    // viewer finished
    if (sessionStage !== "Adding items") {
      return (
        <div className="bg-gray-50 border rounded-xl p-4 text-center">
          <p className="font-medium">You're all set ✅</p>
          <p className="text-sm text-gray-500">
            Waiting for others to finish.
          </p>
        </div>
      );
    }

    return null;
  })();

  const primaryAction = (() => {
    if (sessionStage === "Adding items") {
      return (
        <button
          onClick={() =>
            document.querySelector("input")?.focus()
          }
          className="w-full bg-black text-white py-3 rounded-xl font-medium"
        >
          Add an item
        </button>
      );
    }

    if (sessionStage === "Claiming items") {
      return (
        <button
          onClick={shareInvite}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium"
        >
          Invite friends
        </button>
      );
    }

    if (sessionStage === "Settling payments" && viewerOwesMoney) {
      return (
        <a
          href={createVenmoLink(viewerSettlement!.amount)}
          target="_blank"
          className="block text-center bg-green-600 text-white py-3 rounded-xl font-medium"
        >
          Pay ${viewerSettlement!.amount.toFixed(2)}
        </a>
      );
    }

    if (sessionStage === "Complete" && isHost) {
      return (
        <button
          onClick={finishSplit}
          className="w-full bg-black text-white py-3 rounded-xl font-medium"
        >
          Finish Split
        </button>
      );
    }

    return null;
  })();

  /* ================= UI ================= */

  return (
    <SessionShell
      header={
        <div className="max-w-xl mx-auto px-4 py-4 space-y-1">
          {editingTitle ? (
            <input
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={updateSessionTitle}
              onKeyDown={e => {
                if (e.key === "Enter") updateSessionTitle();
              }}
              autoFocus
              className="text-2xl font-semibold w-full outline-none"
            />
          ) : (
            <h1
              onClick={() => isHost && setEditingTitle(true)}
              className={`text-2xl font-semibold ${
                isHost ? "cursor-pointer hover:opacity-70" : ""
              }`}
            >
              {sessionTitle}
            </h1>
          )}

          <p className="text-sm text-gray-500">
            {sessionStage}
          </p>
        </div>
      }
      footer={primaryAction}
    >
      <div className="space-y-6">
        {/* ACTIVITY FEED */}
        <div className="space-y-2">
          {activities.map(a => (
            <div
              key={a.id}
              className="bg-green-50 text-green-800 px-3 py-2 rounded-lg text-sm animate-pulse"
            >
              {a.message}
            </div>
          ))}
        </div>

        <div
          className={`transition-all ${
            focusSection === "payment"
              ? "scale-[1.02]"
              : ""
          }`}
        >
          {personalCard}
        </div>

        {/* PARTICIPANTS */}
        <div>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
            {participants.map(p => {
              const online = onlineIds.includes(p.id);

              return (
                <div key={p.id} className="flex items-center gap-2">
                  {/* Avatar */}
                  <div
                    className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center ${getAvatarColor(
                      p.id
                    )}`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <span>{p.name}</span>

                  {online && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}

                  {paidIds.includes(p.id) && (
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                      Paid
                    </span>
                  )}

                  {p.id === hostParticipantId && (
                    <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">
                      Host
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      {/* ✅ BILL SUMMARY CARD */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span>Total Bill</span>
        <span className="font-semibold">
        ${billSummary.total.toFixed(2)}
        </span>
      </div>

      <div className="flex justify-between text-sm">
        <span>Claimed</span>
        <span className="text-green-600">
        ${billSummary.claimedTotal.toFixed(2)}
        </span>
      </div>

      <div className="flex justify-between text-sm">
        <span>Unclaimed</span>
        <span className="text-orange-600">
        ${billSummary.remaining.toFixed(2)}
        </span>
      </div>
      </div>

      {/* SPLIT PROGRESS */}
      <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">Split Progress</span>
        <span>{splitProgress.percent}%</span>
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
        className="h-full bg-green-500 transition-all duration-500 ease-out"
        style={{ width: `${splitProgress.percent}%` }}
        />
      </div>

      {splitProgress.unclaimedCount > 0 && (
        <p className="text-xs text-gray-500">
        {splitProgress.unclaimedCount} item
        {splitProgress.unclaimedCount > 1 && "s"} still unclaimed
        </p>
      )}

      {splitProgress.allClaimed && (
        <p className="text-xs text-green-700 font-medium">
        ✓ Everyone has claimed items
        </p>
      )}

      {sessionStage === "Complete" && (
        <div className="bg-green-50 text-green-800 text-center py-3 rounded-xl font-medium animate-pulse ring-2 ring-green-300">
          🎉 Everyone is settled up!
        </div>
      )}
      </div>

      {/* Invite */}
      <button
        onClick={shareInvite}
        disabled={sharing}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        {sharing ? "Sharing…" : "Invite Friends"}
      </button>

      {/* Add item */}
      <div
        className={`flex gap-2 transition-all ${
          focusSection === "input"
            ? "scale-[1.02]"
            : "opacity-80"
        }`}
      >
        <input
          ref={itemInputRef}
          placeholder="Item"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              priceInputRef.current?.focus();
            }
          }}
          className="border p-2 rounded flex-1"
        />
        <input
          ref={priceInputRef}
          placeholder="$"
          value={price}
          onChange={e => setPrice(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") addItem();
          }}
          className="border p-2 rounded w-24"
        />
        <button
          onClick={addItem}
          className="bg-black text-white px-4 rounded"
        >
          Add
        </button>
      </div>

      {/* ITEMS */}

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <p className="text-gray-600 font-medium">
            No items yet
          </p>

          <p className="text-sm text-gray-500 mt-2">
            Add items to start splitting the bill.
          </p>
        </div>
      ) : (
        <ul
          className={`bg-white rounded-xl shadow-sm divide-y transition-all ${
            focusSection === "items"
              ? "ring-2 ring-green-200"
              : ""
          }`}
        >
          {items.map(item => {
            const claimedByMe =
              participantId &&
              claims.some(
                c =>
                  c.item_id === item.id &&
                  c.participant_id === participantId
              );

            const owners = participants
              .filter(p =>
                claims.some(
                  c =>
                    c.item_id === item.id &&
                    c.participant_id === p.id
                )
              )
              .map(p => p.name);

            return (
              <li
                key={item.id}
                onClick={() => toggleClaim(item.id)}
                className={`px-4 py-3 cursor-pointer transition-all duration-150 ${
                  claimedByMe
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

                {owners.length > 0 && (
                  <div className="text-sm text-gray-500 mt-1">
                    ✓ {owners.join(", ")}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* TOTALS */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Live Totals</h2>

        <div className="bg-white rounded-xl shadow-sm divide-y">
          {participants.map(p => {
            const online = onlineIds.includes(p.id);

            return (
              <div
                key={p.id}
                className="flex justify-between items-center px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full text-white text-xs flex items-center justify-center ${getAvatarColor(
                      p.id
                    )}`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  <span>{p.name}</span>
                </div>

                <span className="font-semibold transition-all duration-300">
                  ${totals[p.id].toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SETTLEMENT */}
      {settlements.length > 0 && (
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
                  totalDebtors
                    ? (paidCount / totalDebtors) * 100
                    : 0
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
                    paidIds.includes(s.fromId)
                      ? "bg-green-50"
                      : ""
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

                  {viewerIsDebtor && !paidIds.includes(s.fromId) && (
                    <div className="flex gap-2">
                        <a
                        href={createVenmoLink(s.amount)}
                        target="_blank"
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm"
                        >
                        Pay with Venmo
                        </a>

                        <button
                        onClick={() => markPaid(s.fromId)}
                        className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm"
                        >
                        Mark as Paid
                        </button>
                    </div>
                    )}

                    {paidIds.includes(s.fromId) && viewerIsDebtor && (
                    <span className="text-green-700 text-sm font-medium">
                        ✓ Paid
                    </span>
                    )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <button
              onClick={finishSplit}
              disabled={paidCount !== totalDebtors}
              className={`w-full py-3 rounded-xl font-medium ${
                paidCount === totalDebtors
                  ? "bg-black text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              Finish Split
            </button>
          )}
        </div>
      )}
      </div>
    </SessionShell>
  );
}