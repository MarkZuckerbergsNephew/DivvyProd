"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function JoinClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    const { data: participant, error: insertError } = await supabase
      .from("participants")
      .insert({
        session_id: sessionId,
        name: trimmedName,
      })
      .select()
      .single();

    if (insertError) {
      console.error(insertError);
      setError("Failed to join. Please try again.");
      return;
    }

    const participantId = participant?.id;
    if (participantId) {
      router.push(`/session/${sessionId}?participant=${participantId}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Join the split
        </h1>

        <p className="text-sm text-gray-500 mb-6">
          Enter your name so friends know it&apos;s you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Your name"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-gray-900 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
          >
            Join Session
          </button>
        </form>
      </div>
    </div>
  );
}
