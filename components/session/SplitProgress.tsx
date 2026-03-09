"use client";

type Props = {
  percent: number;
  unclaimedCount: number;
  allClaimed: boolean;
  sessionStage: string;
};

export default function SplitProgress({
  percent,
  unclaimedCount,
  allClaimed,
  sessionStage,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-900">Split Progress</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
          {percent}%
        </span>
      </div>

      <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {unclaimedCount > 0 && (
        <p className="text-xs text-gray-500">
          {unclaimedCount} item{unclaimedCount > 1 && "s"} still unclaimed
        </p>
      )}

      {allClaimed && (
        <p className="text-xs text-green-700 font-medium">
          ✓ Everyone has claimed items
        </p>
      )}

      {sessionStage === "Claiming items" && (
        <p className="text-sm text-gray-600">
          Waiting for everyone to claim their items
        </p>
      )}

      {sessionStage === "Complete" && (
        <div className="bg-green-50 text-green-800 text-center py-3 rounded-xl font-medium animate-pulse ring-2 ring-green-300">
          🎉 Everyone is settled up!
        </div>
      )}
    </div>
  );
}
