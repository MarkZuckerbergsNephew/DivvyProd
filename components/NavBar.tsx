"use client";

import { useRouter } from "next/navigation";

export default function NavBar() {
  const router = useRouter();

  return (
    <nav className="w-full border-b border-[var(--divvy-card-border)] bg-[var(--divvy-card)] backdrop-blur-xl supports-[padding:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)]">
      <div className="max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-3 flex justify-between items-center min-h-[48px]">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="font-bold text-slate-900 text-lg -ml-1 py-2 px-1 min-h-[44px] flex items-center"
        >
          Divvy
        </button>
        <button
          type="button"
          onClick={() => router.push("/create")}
          className="text-sm font-medium text-teal-600 py-2 px-3 min-h-[44px] flex items-center rounded-lg active:bg-teal-50"
        >
          New split
        </button>
      </div>
    </nav>
  );
}
