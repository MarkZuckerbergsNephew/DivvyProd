"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function join() {
    if (!name.trim()) return;
    setError("");

    const { data, error: insertError } = await supabase
      .from("participants")
      .insert({
        name: name.trim(),
        session_id: sessionId,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error(insertError);
      setError("Failed to join.");
      return;
    }

    // First joiner becomes host
    const { data: session } = await supabase
      .from("sessions")
      .select("host_participant_id")
      .eq("id", sessionId)
      .single();

    if (!session?.host_participant_id) {
      await supabase
        .from("sessions")
        .update({ host_participant_id: data.id })
        .eq("id", sessionId);
    }

    router.push(`/session/${sessionId}?participant=${data.id}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">
          Join Split
        </h1>

        <input
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && join()}
          className="border rounded-lg px-3 py-2 w-full"
        />

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={join}
          className="w-full bg-black text-white py-3 rounded-xl"
        >
          Join
        </button>
      </div>
    </main>
  );
}
