"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function joinSplit() {
    if (!code.trim()) return;
    setError("");

    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("join_code", code.trim().toUpperCase())
      .single();

    if (!data) {
      setError("Invalid code");
      return;
    }

    router.push(`/join/${data.id}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold mb-2">Divvy</h1>

      <p className="text-gray-600 mb-8">
        Split bills with friends instantly
      </p>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => router.push("/create")}
          className="w-full bg-black text-white py-3 rounded-xl font-medium"
        >
          Start a Split
        </button>

        <div className="flex gap-2">
          <input
            placeholder="Enter split code"
            value={code}
            onChange={e => {
              setCode(e.target.value);
              setError("");
            }}
            onKeyDown={e => e.key === "Enter" && joinSplit()}
            className="border rounded-lg px-3 py-2 flex-1"
          />

          <button
            onClick={joinSplit}
            className="bg-gray-900 text-white px-4 rounded-lg"
          >
            Join
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
      </div>
    </main>
  );
}
