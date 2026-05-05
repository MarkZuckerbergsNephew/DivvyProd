"use client";

type Props = {
  subtotal: number;
  claimedTotal: number;
  remaining: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  /** When false (e.g. General split), only the Tip row is hidden; Tax still shows. */
  showTip?: boolean;
  /** When true, render without outer card (for use inside combined Bill card). */
  inline?: boolean;
};

export default function BillSummaryCard({
  subtotal,
  claimedTotal,
  remaining,
  taxAmount,
  tipAmount,
  total,
  showTip = true,
  inline,
}: Props) {
  const content = (
    <>
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-500">Subtotal</span>
        <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-500">Claimed</span>
        <span className="font-semibold text-emerald-600">${claimedTotal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-500">Unclaimed</span>
        <span className="font-semibold text-amber-600">${remaining.toFixed(2)}</span>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-500">Tax</span>
        <span className="font-medium text-slate-700">${taxAmount.toFixed(2)}</span>
      </div>

      {showTip && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Tip</span>
          <span className="font-medium text-slate-700">${tipAmount.toFixed(2)}</span>
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 mt-1 flex justify-between items-center">
        <span className="text-base font-bold text-slate-900">Total</span>
        <span className="text-lg font-bold text-[var(--accent)]">${total.toFixed(2)}</span>
      </div>
    </>
  );
  if (inline) return <div className="space-y-3.5">{content}</div>;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)] space-y-3">
      {content}
    </div>
  );
}
