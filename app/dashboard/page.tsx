"use client";

import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-gray-600 text-sm">
          Recent splits and quick actions
        </p>

        <button
          onClick={() => router.push("/create")}
          className="w-full bg-black text-white py-3 rounded-xl font-medium"
        >
          Start New Split
        </button>

        <button
          onClick={() => router.push("/")}
          className="w-full border py-2 rounded-xl text-gray-600"
        >
          Back to Home
        </button>
      </div>
    </main>
  );
}
