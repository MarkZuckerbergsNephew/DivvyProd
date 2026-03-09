"use client";

type Props = {
  subtotal: number;
  claimedTotal: number;
  remaining: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
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
  inline,
}: Props) {
  const content = (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Subtotal</span>
        <span className="font-medium text-slate-900">${subtotal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Claimed</span>
        <span className="font-medium text-green-600">
          ${claimedTotal.toFixed(2)}
        </span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Unclaimed</span>
        <span className="font-medium text-orange-600">
          ${remaining.toFixed(2)}
        </span>
      </div>

      <div className="flex justify-between text-sm text-gray-600">
        <span>Tax</span>
        <span>${taxAmount.toFixed(2)}</span>
      </div>

      <div className="flex justify-between text-sm text-gray-600">
        <span>Tip</span>
        <span>${tipAmount.toFixed(2)}</span>
      </div>

      <div className="border-t pt-2 flex justify-between font-semibold">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
    </>
  );
  if (inline) return <div className="space-y-3">{content}</div>;
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur space-y-3">
      {content}
    </div>
  );
}
