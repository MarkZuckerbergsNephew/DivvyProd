"use client";

import { useState, useMemo } from "react";
import ParticipantAvatar from "@/components/ParticipantAvatar";
import { CategoryBadge, CATEGORIES } from "./CategoryChips";

type Item = {
  id: string;
  name: string;
  price: number | null;
  added_by: string | null;
  item_date: string;
  category: string | null;
};

type Claim = {
  id: string;
  item_id: string;
  participant_id: string;
  amount: number | null;
};

type Participant = { id: string; name: string };

type Settlement = {
  id: string;
  from_participant_id: string;
  to_participant_id: string;
  amount: number;
  settled_at: string;
};

type Props = {
  items: Item[];
  claims: Claim[];
  participants: Participant[];
  settlements: Settlement[];
  sessionTitle: string;
};

export default function MonthlySummary({
  items,
  claims,
  participants,
  settlements,
  sessionTitle,
}: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [exporting, setExporting] = useState(false);

  const monthName = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const monthItems = useMemo(() =>
    items.filter((item) => {
      const d = new Date(item.item_date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    }),
    [items, year, month],
  );

  const totalSpending = useMemo(
    () => monthItems.reduce((sum, i) => sum + (i.price ?? 0), 0),
    [monthItems],
  );

  const perPersonSpending = useMemo(() => {
    const map: Record<string, number> = {};
    monthItems.forEach((item) => {
      claims
        .filter((c) => c.item_id === item.id)
        .forEach((c) => {
          map[c.participant_id] = (map[c.participant_id] ?? 0) + (c.amount ?? 0);
        });
    });
    return map;
  }, [monthItems, claims]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    monthItems.forEach((item) => {
      const cat = item.category ?? "other";
      map[cat] = (map[cat] ?? 0) + (item.price ?? 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthItems]);

  const monthSettlements = useMemo(
    () =>
      settlements.filter((s) => {
        const d = new Date(s.settled_at);
        return d.getFullYear() === year && d.getMonth() === month;
      }),
    [settlements, year, month],
  );

  async function exportPDF() {
    if (monthItems.length === 0) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Divvy", 14, 20);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`${sessionTitle} · ${monthName}`, 14, 28);
      doc.setTextColor(0);

      // Section 1: Expenses
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Expenses", 14, 42);

      autoTable(doc, {
        startY: 46,
        head: [["Date", "Item", "Category", "Amount", "Added by", "Claimed by"]],
        body: monthItems.map((item) => {
          const adder = participants.find((p) => p.id === item.added_by);
          const claimers = claims
            .filter((c) => c.item_id === item.id)
            .map((c) => participants.find((p) => p.id === c.participant_id)?.name ?? "?")
            .join(", ");
          return [
            new Date(item.item_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            item.name,
            item.category ?? "other",
            `$${(item.price ?? 0).toFixed(2)}`,
            adder?.name ?? "?",
            claimers || "Unclaimed",
          ];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 148, 136] },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const afterItems = (doc as any).lastAutoTable.finalY + 10;

      // Section 2: Per-person
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Per-person summary", 14, afterItems);

      autoTable(doc, {
        startY: afterItems + 4,
        head: [["Member", "Amount spent"]],
        body: participants.map((p) => [p.name, `$${(perPersonSpending[p.id] ?? 0).toFixed(2)}`]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [13, 148, 136] },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const afterPerson = (doc as any).lastAutoTable.finalY + 10;

      // Section 3: Settlements
      if (monthSettlements.length > 0) {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Settlements", 14, afterPerson);

        autoTable(doc, {
          startY: afterPerson + 4,
          head: [["Date", "From", "To", "Amount"]],
          body: monthSettlements.map((s) => {
            const fp = participants.find((p) => p.id === s.from_participant_id);
            const tp = participants.find((p) => p.id === s.to_participant_id);
            return [
              new Date(s.settled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              fp?.name ?? "?",
              tp?.name ?? "?",
              `$${s.amount.toFixed(2)}`,
            ];
          }),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [13, 148, 136] },
        });
      }

      // Footer on each page
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text("Generated by Divvy", 14, doc.internal.pageSize.height - 10);
        doc.text(
          `Page ${i} of ${pages}`,
          doc.internal.pageSize.width - 40,
          doc.internal.pageSize.height - 10,
        );
      }

      const slug = sessionTitle.toLowerCase().replace(/\s+/g, "-");
      const monthSlug = new Date(year, month)
        .toLocaleDateString("en-US", { month: "long", year: "numeric" })
        .toLowerCase()
        .replace(/\s+/g, "-");
      doc.save(`divvy-${slug}-${monthSlug}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-2 py-1 shadow-[var(--shadow-card)]">
        <button
          type="button"
          onClick={prevMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 transition-colors text-xl"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-900">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 transition-colors text-xl disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {monthItems.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium text-slate-700">No expenses in {monthName}</p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[var(--shadow-card)] overflow-hidden">
            {/* Total */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Total group spending</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">
                  ${totalSpending.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-muted)]">
                  {monthItems.length} expense{monthItems.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {monthSettlements.length} settlement{monthSettlements.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Per person */}
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Per person
              </p>
              <div className="space-y-2">
                {participants.map((p) => {
                  const spent = perPersonSpending[p.id] ?? 0;
                  const pct = totalSpending > 0 ? (spent / totalSpending) * 100 : 0;
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ParticipantAvatar name={p.name} size="sm" />
                        <span className="text-sm text-slate-700 flex-1 truncate">{p.name}</span>
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          ${spent.toFixed(2)}
                        </span>
                        <span className="text-xs text-[var(--text-hint)] w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category breakdown — CSS bar chart */}
            {categoryBreakdown.length > 0 && (
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  By category
                </p>
                <div className="space-y-2.5">
                  {categoryBreakdown.map(([catId, amount]) => {
                    const cat = CATEGORIES.find((c) => c.id === catId);
                    const pct = totalSpending > 0 ? (amount / totalSpending) * 100 : 0;
                    return (
                      <div key={catId} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-xs font-medium"
                            style={{ color: cat?.color ?? "#6B7280" }}
                          >
                            {cat?.emoji ?? "📦"} {cat?.label ?? catId}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 tabular-nums">
                            ${amount.toFixed(2)}{" "}
                            <span className="text-[var(--text-hint)] font-normal">
                              ({pct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: cat?.color ?? "#6B7280" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Export button */}
          <button
            type="button"
            onClick={exportPDF}
            disabled={exporting}
            className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                Generating PDF…
              </>
            ) : (
              <>📄 Export PDF</>
            )}
          </button>
        </>
      )}
    </div>
  );
}
