"use client";

type Props = {
  taxInput: string;
  tipInput: string;
  setTaxInput: (v: string) => void;
  setTipInput: (v: string) => void;
  /** When true, render without outer card (for use inside combined Bill card). */
  inline?: boolean;
};

export default function TaxTipInputs({
  taxInput,
  tipInput,
  setTaxInput,
  setTipInput,
  inline,
}: Props) {
  const content = (
    <>
      {!inline && (
        <h3 className="font-semibold text-sm text-gray-700">
          Bill Adjustments
        </h3>
      )}

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500 block mb-2">
            Tax ($)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={taxInput}
            onChange={e => setTaxInput(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-base text-slate-900 shadow-inner outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex-1">
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500 block mb-2">
            Tip ($)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={tipInput}
            onChange={e => setTipInput(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-base text-slate-900 shadow-inner outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
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
