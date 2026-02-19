"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  from: string;
  to: string;
  amount: number;
};

/* ================= COMPONENT ================= */

export default function SessionClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const searchParams = useSearchParams();

  /* ---------- STATE ---------- */

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] =
    useState<string | null>(null);

  const [hostParticipantId, setHostParticipantId] =
    useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [sharing, setSharing] = useState(false);

  /* ================= INVITE LINK ================= */

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
    } catch {
      // user cancelled share
    } finally {
      setSharing(false);
    }
  }

  /* ================= PARTICIPANT ================= */

  useEffect(() => {
    const id = searchParams.get("participant");
    setParticipantId(id);
  }, [searchParams]);

  useEffect(() => {
    if (!participantId) return;

    async function fetchParticipant() {
      const { data } = await supabase
        .from("participants")
        .select("name")
        .eq("id", participantId)
        .single();

      if (data) setParticipantName(data.name);
    }

    fetchParticipant();
  }, [participantId]);

  /* ================= FETCHERS ================= */

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
      .select("id, name")
      .eq("session_id", sessionId);

    setParticipants(data ?? []);
  }

  async function fetchSession() {
    const { data } = await supabase
      .from("sessions")
      .select("host_participant_id")
      .eq("id", sessionId)
      .single();

    if (data?.host_participant_id) {
      setHostParticipantId(data.host_participant_id);
    }
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

  /* ================= INITIAL LOAD ================= */

  useEffect(() => {
    fetchItems();
    fetchClaims();
    fetchParticipants();
    fetchSession();
  }, [sessionId]);

  /* ================= REALTIME ================= */

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`session-${sessionId}`)

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `session_id=eq.${sessionId}`,
        },
        fetchItems
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "claims",
        },
        fetchClaims
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        fetchParticipants
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  /* ================= CLAIM TOGGLE ================= */

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
    }
  }

  /* ================= ADD ITEM ================= */

  async function addItem() {
    const numericPrice = Number(price);

    if (!name.trim() || isNaN(numericPrice)) {
      alert("Enter valid name and price");
      return;
    }

    await supabase.from("items").insert({
      session_id: sessionId,
      name: name.trim(),
      price: numericPrice,
    });

    setName("");
    setPrice("");
  }

  /* ================= HELPERS ================= */

  function getOwners(itemId: string) {
    const ownerIds = claims
      .filter(c => c.item_id === itemId)
      .map(c => c.participant_id);

    return participants
      .filter(p => ownerIds.includes(p.id))
      .map(p => p.name);
  }

  /* ================= TOTALS ================= */

  function calculateTotals() {
    const totals: Record<string, number> = {};

    participants.forEach(p => (totals[p.id] = 0));

    items.forEach(item => {
      const claimers = claims.filter(
        c => c.item_id === item.id
      );

      if (!claimers.length) return;

      const split =
        Number(item.price ?? 0) / claimers.length;

      claimers.forEach(c => {
        totals[c.participant_id] += split;
      });
    });

    return totals;
  }

  const totals = calculateTotals();

  /* ================= SETTLEMENT ================= */

  function getSettlements(): SettlementRow[] {
    if (!hostParticipantId) return [];

    const host = participants.find(
      p => p.id === hostParticipantId
    );
    if (!host) return [];

    return participants
      .filter(p => p.id !== hostParticipantId)
      .filter(p => totals[p.id] > 0)
      .map(p => ({
        from: p.name,
        to: host.name,
        amount: totals[p.id],
      }));
  }

  const settlements = getSettlements();

  /* ================= UI ================= */

  return (
    <div className="p-10 space-y-6">

      {participantName && (
        <p className="text-sm text-gray-600">
          You are: <span className="font-medium">{participantName}</span>
        </p>
      )}

      {/* SHARE */}
      <button
        onClick={shareInvite}
        disabled={sharing}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {sharing ? "Sharing..." : "Invite Friends"}
      </button>

      {/* ADD ITEM */}
      <div className="flex gap-2">
        <input
          placeholder="Item name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
          className="border p-2 rounded"
        />

        <button
          onClick={addItem}
          className="bg-black text-white px-4 rounded"
        >
          Add
        </button>
      </div>

      {/* ITEMS */}
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {items.map(item => {
          const claimedByMe =
            participantId &&
            claims.some(
              c =>
                c.item_id === item.id &&
                c.participant_id === participantId
            );

          const owners = getOwners(item.id);

          return (
            <li
              key={item.id}
              onClick={() => toggleClaim(item.id)}
              className={`flex flex-col px-4 py-3 cursor-pointer transition
                ${claimedByMe
                  ? "bg-green-100 border-l-4 border-green-500"
                  : "hover:bg-gray-50"}
              `}
            >
              <div className="flex justify-between">
                <span>{item.name}</span>
                <span className="font-medium">
                  ${Number(item.price ?? 0).toFixed(2)}
                </span>
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

      {/* TOTALS */}
      <div>
        <h2 className="text-xl font-semibold mb-3">
          Live Split
        </h2>

        <div className="bg-white rounded-xl shadow-sm divide-y">
          {participants.map(p => (
            <div
              key={p.id}
              className="flex justify-between px-4 py-3"
            >
              <span>{p.name}</span>
              <span className="font-semibold">
                ${totals[p.id].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SETTLEMENT */}
      {settlements.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">
            Who Pays Who
          </h2>

          <div className="bg-white rounded-xl shadow-sm divide-y">
            {settlements.map((s, i) => (
              <div
                key={i}
                className="flex justify-between px-4 py-3"
              >
                <span>
                  <b>{s.from}</b> → <b>{s.to}</b>
                </span>
                <span>${s.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
