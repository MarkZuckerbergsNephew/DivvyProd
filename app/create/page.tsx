"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateJoinCode } from "@/lib/generateCode";
import { useState } from "react";

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createSession(type: "restaurant" | "general") {
    if (loading) return;
    setLoading(true);

    const joinCode = generateJoinCode();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        title: "New Split",
        split_type: type,
        join_code: joinCode,
      })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      setLoading(false);
      return;
    }

    router.push(`/join/${data.id}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-semibold">
          What are you splitting?
        </h1>

        <button
          onClick={() => createSession("restaurant")}
          className="w-full border p-5 rounded-2xl text-left hover:bg-gray-50"
        >
          <p className="font-semibold">🍽 Restaurant</p>
          <p className="text-sm text-gray-500">
            Add tax and tip
          </p>
        </button>

        <button
          onClick={() => createSession("general")}
          className="w-full border p-5 rounded-2xl text-left hover:bg-gray-50"
        >
          <p className="font-semibold">🧾 General</p>
          <p className="text-sm text-gray-500">
            Trips, groceries, rent
          </p>
        </button>
      </div>
    </main>
  );
}
