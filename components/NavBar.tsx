"use client";

import { useRouter } from "next/navigation";

export default function NavBar() {
  const router = useRouter();

  return (
    <div className="w-full border-b px-4 py-3 flex justify-between">
      <button
        onClick={() => router.push("/")}
        className="font-bold"
      >
        Divvy
      </button>

      <button
        onClick={() => router.push("/create")}
        className="text-sm text-gray-600"
      >
        New Split
      </button>
    </div>
  );
}
