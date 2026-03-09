"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { calculateTotals } from "@/lib/billMath";

type Participant = {
  id: string;
  name: string;
  venmo_username?: string | null;
};

function createVenmoLink(amount: number, venmoUsername?: string | null) {
  const params = `txn=pay&amount=${amount.toFixed(2)}&note=Divvy%20Split`;
  if (venmoUsername?.trim()) {
    return `https://venmo.com/${encodeURIComponent(venmoUsername.trim())}?${params}`;
  }
  return `https://venmo.com/?${params}`;
}

export default function PayPageClient({
  sessionId,
  participantId,
}: {
  sessionId: string;
  participantId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostVenmo, setHostVenmo] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase
        .from("sessions")
        .select("host_participant_id, tax_amount, tip_amount")
        .eq("id", sessionId)
        .single();

      const { data: participants } = await supabase
        .from("participants")
        .select("id, name, venmo_username")
        .eq("session_id", sessionId);

      const { data: items } = await supabase
        .from("items")
        .select("id, price")
        .eq("session_id", sessionId);

      const itemIds = (items ?? []).map((i: { id: string }) => i.id);
      let claimsFiltered: { item_id: string; participant_id: string; amount?: number }[] = [];
      if (itemIds.length > 0) {
        const { data: claimsData } = await supabase
          .from("claims")
          .select("item_id, participant_id, amount")
          .in("item_id", itemIds);
        claimsFiltered = claimsData ?? [];
      }

      const { data: payments } = await supabase
        .from("payments")
        .select("participant_id")
        .eq("session_id", sessionId);
      const paidIds = (payments ?? []).map(
        (p: { participant_id: string }) => p.participant_id
      );
      setMarked(paidIds.includes(participantId));

      if (!session?.host_participant_id || !participants?.length || !items) {
        setError("Session not found");
        setLoading(false);
        return;
      }

      const host = (participants as Participant[]).find(
        (p) => p.id === session.host_participant_id
      );
      if (!host) {
        setError("Session not found");
        setLoading(false);
        return;
      }

      const taxAmount = Number(session.tax_amount ?? 0);
      const tipAmount = Number(session.tip_amount ?? 0);
      const totals = calculateTotals(
        items,
        claimsFiltered,
        participants as { id: string }[],
        taxAmount,
        tipAmount
      );

      const owed = totals[participantId] ?? 0;
      if (owed <= 0) {
        setError("You don't owe anything for this split.");
        setLoading(false);
        return;
      }

      setHostName(host.name);
      setHostVenmo(host.venmo_username ?? null);
      setAmount(owed);
      setLoading(false);
    }

    load();
  }, [sessionId, participantId]);

  async function markPaid() {
    setMarking(true);
    const { error: err } = await supabase.from("payments").upsert(
      { session_id: sessionId, participant_id: participantId },
      { onConflict: "session_id,participant_id" }
    );
    setMarking(false);
    if (!err) setMarked(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (error || amount == null) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-red-500 mb-4">{error || "Something went wrong."}</p>
        <button
          onClick={() => router.push("/")}
          className="text-gray-600 underline"
        >
          Back to home
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">
          You owe {hostName} ${amount.toFixed(2)}
        </h1>

        <div className="flex flex-col gap-3">
          <a
            href={createVenmoLink(amount, hostVenmo)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-green-600 text-white py-3 rounded-xl font-medium text-center"
          >
            Pay with Venmo
          </a>

          {!marked ? (
            <button
              onClick={markPaid}
              disabled={marking}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium disabled:opacity-50"
            >
              {marking ? "…" : "Mark as Paid"}
            </button>
          ) : (
            <p className="text-green-600 font-medium">✓ Paid</p>
          )}
        </div>

        <button
          onClick={() => router.push(`/session/${sessionId}?participant=${participantId}`)}
          className="text-gray-500 text-sm"
        >
          Open full session
        </button>
      </div>
    </main>
  );
}
