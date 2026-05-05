"use client";

import { motion } from "framer-motion";

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
    <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)] space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-800">Split progress</span>
        <span className="rounded-full bg-teal-100 text-teal-700 px-2.5 py-1 font-medium">
          {percent}%
        </span>
      </div>

      <div className="w-full h-3 bg-slate-200/90 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          style={{ originX: 0 }}
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
    </div>
  );
}
