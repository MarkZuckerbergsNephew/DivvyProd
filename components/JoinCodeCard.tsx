"use client";

export default function JoinCodeCard({ code }: { code: string }) {
  return (
    <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-700/80">
        Share this code with friends
      </p>
      <div className="mt-2 rounded-xl bg-white/80 px-4 py-3 text-3xl font-mono font-bold tracking-[0.35em] text-slate-900">
        {code}
      </div>
    </div>
  );
}
