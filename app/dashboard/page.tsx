"use client";

import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  async function createSession() {
    /* 1️⃣ create session */
    const { data: session } = await supabase
      .from("sessions")
      .insert([{ title: "New Split" }])
      .select()
      .single();

    if (!session) return;

    /* 2️⃣ create host participant */
    const { data: host } = await supabase
      .from("participants")
      .insert({
        session_id: session.id,
        name: "Host",
        phone: "host",
        venmo_username: "your-venmo-username", // change later
      })
      .select()
      .single();

    if (!host) return;

    /* 3️⃣ attach host to session */
    await supabase
      .from("sessions")
      .update({
        host_participant_id: host.id,
      })
      .eq("id", session.id);

    /* 4️⃣ redirect */
    router.push(
      `/session/${session.id}?participant=${host.id}`
    );
  }

  return (
    <div className="p-10">
      <h1 className="text-3xl mb-6">Dashboard</h1>

      <button
        onClick={createSession}
        className="bg-black text-white px-6 py-3 rounded-lg"
      >
        New Split
      </button>
    </div>
  );
}
