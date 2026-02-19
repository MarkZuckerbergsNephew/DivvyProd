import { supabase } from "./supabase";

export type Settlement = {
  participant_id: string;
  name: string;
  owes: number;
  venmo?: string | null;
};

export async function calculateSettlement(sessionId: string) {
  /* ---------------- SESSION ---------------- */

  const { data: session } = await supabase
    .from("sessions")
    .select("host_participant_id, title")
    .eq("id", sessionId)
    .single();

  if (!session) return [];

  const hostId = session.host_participant_id;

  /* ---------------- PARTICIPANTS ---------------- */

  const { data: participants } = await supabase
    .from("participants")
    .select("id, name, venmo_username")
    .eq("session_id", sessionId);

  if (!participants) return [];

  /* ---------------- ITEMS ---------------- */

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("session_id", sessionId);

  if (!items) return [];

  /* ---------------- CLAIMS ---------------- */

  const { data: claims } = await supabase
    .from("claims")
    .select("*");

  /* ---------------- CALCULATION ---------------- */

  const totals: Record<string, number> = {};

  participants.forEach(p => {
    totals[p.id] = 0;
  });

  items.forEach(item => {
    const itemClaims = claims?.filter(
      c => c.item_id === item.id
    ) ?? [];

    if (itemClaims.length === 0) return;

    const share = Number(item.price ?? 0) / itemClaims.length;

    itemClaims.forEach(c => {
      totals[c.participant_id] += share;
    });
  });

  /* ---------------- HOST INFO ---------------- */

  const { data: host } = await supabase
    .from("participants")
    .select("venmo_username")
    .eq("id", hostId)
    .single();

  /* ---------------- RESULT ---------------- */

  const result: Settlement[] = participants
    .filter(p => p.id !== hostId)
    .map(p => ({
      participant_id: p.id,
      name: p.name,
      owes: Number(totals[p.id].toFixed(2)),
      venmo: host?.venmo_username ?? null,
    }));

  return result;
}
