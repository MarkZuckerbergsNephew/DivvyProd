"use client";

import { useState, useEffect } from "react";

type Props = {
  balance: number;
  onSettleUp: () => void;
  dismissKey: string;
};

export default function NudgeBanner({ balance, onSettleUp, dismissKey }: Props) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  function dismiss() {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  if (dismissed === null || dismissed) return null;

  const owesAmount = -balance;
  const owes = balance < -0.005;

  if (!owes) return null;

  const strong = owesAmount > 100;
  return (
    <div
      className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
        strong
          ? "bg-red-50 border border-red-200"
          : "bg-amber-50 border border-amber-200"
      }`}
    >
      <span className="text-xl shrink-0">{strong ? "🚨" : "⚠️"}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${strong ? "text-red-800" : "text-amber-800"}`}>
          You owe ${owesAmount.toFixed(2)}
        </p>
        <p className={`text-xs mt-0.5 ${strong ? "text-red-600" : "text-amber-600"}`}>
          Settle up to keep things balanced
        </p>
      </div>
      <button
        type="button"
        onClick={onSettleUp}
        className="shrink-0 min-h-[36px] px-3 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-dark)] transition-colors"
      >
        Settle up
      </button>
      <button
        type="button"
        onClick={dismiss}
        className={`shrink-0 text-xl leading-none ${
          strong ? "text-red-300" : "text-amber-300"
        } hover:opacity-70 transition-opacity`}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
