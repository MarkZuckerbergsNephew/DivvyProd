"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CategoryChips, { CategoryBadge } from "./CategoryChips";

export type Frequency = "weekly" | "biweekly" | "monthly";

export type RecurringExpense = {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  frequency: Frequency;
  next_date: string;
  last_added_at: string | null;
};

const FREQ_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const FREQ_SUFFIX: Record<Frequency, string> = {
  weekly: "week",
  biweekly: "2 weeks",
  monthly: "month",
};

type Props = {
  expenses: RecurringExpense[];
  onAdd: (data: {
    name: string;
    amount: number;
    category: string | null;
    frequency: Frequency;
    start_date: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function RecurringExpenses({ expenses, onAdd, onDelete }: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    const parsed = parseFloat(amount);
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return;
    setSaving(true);
    await onAdd({ name: name.trim(), amount: parsed, category, frequency, start_date: startDate });
    setSaving(false);
    setShowSheet(false);
    setName("");
    setAmount("");
    setCategory(null);
    setFrequency("monthly");
    setStartDate(new Date().toISOString().split("T")[0]);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Recurring
        </h3>
        <button
          type="button"
          onClick={() => setShowSheet(true)}
          className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors min-h-[28px] px-1"
        >
          + Add
        </button>
      </div>

      {expenses.length === 0 ? (
        <p className="text-xs text-[var(--text-hint)] py-1">
          No recurring expenses. Add one to auto-charge on schedule.
        </p>
      ) : (
        <div className="space-y-1.5">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-3 py-2.5 shadow-[var(--shadow-card)]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 truncate">{exp.name}</span>
                  <CategoryBadge category={exp.category} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {FREQ_LABELS[exp.frequency]} · Next:{" "}
                  {new Date(exp.next_date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <span className="font-bold text-[var(--accent)] text-sm shrink-0">
                ${exp.amount.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(exp.id)}
                disabled={deletingId === exp.id}
                className="text-slate-300 hover:text-red-400 transition-colors p-1 disabled:opacity-40 min-h-[28px]"
                aria-label="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add sheet */}
      <AnimatePresence>
        {showSheet && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Add recurring expense</h3>
                <button
                  type="button"
                  onClick={() => setShowSheet(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <input
                  placeholder="Expense name (e.g. Netflix)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                />
                <input
                  type="number"
                  placeholder="Amount ($)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                />

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Category (optional)</p>
                  <CategoryChips selected={category} onChange={setCategory} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Frequency</p>
                  <div className="flex gap-2">
                    {(["weekly", "biweekly", "monthly"] as Frequency[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={`flex-1 min-h-[40px] rounded-xl text-xs font-semibold transition-all ${
                          frequency === f
                            ? "bg-[var(--accent)] text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {f === "weekly" ? "Weekly" : f === "biweekly" ? "Biweekly" : "Monthly"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Start date</p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                  />
                </div>

                {startDate && (
                  <p className="text-xs text-[var(--text-muted)] bg-slate-50 rounded-xl px-3 py-2.5">
                    Preview: Next charge{" "}
                    {new Date(startDate + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {", "}then every {FREQ_SUFFIX[frequency]}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !name.trim() || !amount}
                className="w-full min-h-[52px] rounded-xl bg-[var(--accent)] text-white font-semibold text-base hover:bg-[var(--accent-dark)] transition-all disabled:opacity-40"
              >
                {saving ? "Adding…" : "Add recurring expense"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
