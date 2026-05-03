"use client";

import { motion } from "framer-motion";

const STAGES = [
  { id: "Adding items", label: "Add items" },
  { id: "Claiming items", label: "Claim" },
  { id: "Settling payments", label: "Settle" },
  { id: "Complete", label: "Done" },
] as const;

type Props = {
  currentStage: string;
};

export default function StageHeader({ currentStage }: Props) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="flex items-center justify-between gap-1 rounded-xl bg-slate-200/90 p-1.5 border border-slate-300/80 shadow-sm">
      {STAGES.map((stage, i) => {
        const isCurrent = stage.id === currentStage;
        const isPast = i < effectiveIndex;

        return (
          <div
            key={stage.id}
            className="flex-1 flex flex-col items-center min-w-0"
          >
            <motion.span
              className={`text-xs font-medium px-2 py-1.5 rounded-lg w-full text-center truncate ${
                isCurrent
                  ? "bg-slate-800 text-white shadow-md"
                  : isPast
                    ? "text-slate-600"
                    : "text-slate-500"
              }`}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {stage.label}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}
