"use client";

export type CategoryId =
  | "rent"
  | "groceries"
  | "utilities"
  | "entertainment"
  | "transport"
  | "other";

export type CategoryDef = {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
  bg: string;
};

export const CATEGORIES: CategoryDef[] = [
  { id: "rent",          label: "Rent",          emoji: "🏠", color: "#8B5CF6", bg: "#EDE9FE" },
  { id: "groceries",     label: "Groceries",     emoji: "🛒", color: "#22C55E", bg: "#F0FDF4" },
  { id: "utilities",     label: "Utilities",     emoji: "💡", color: "#F59E0B", bg: "#FFFBEB" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬", color: "#EC4899", bg: "#FDF2F8" },
  { id: "transport",     label: "Transport",     emoji: "🚗", color: "#3B82F6", bg: "#EFF6FF" },
  { id: "other",         label: "Other",         emoji: "📦", color: "#6B7280", bg: "#F3F4F6" },
];

type ChipsProps = {
  selected: string | null;
  onChange: (id: string | null) => void;
};

export default function CategoryChips({ selected, onChange }: ChipsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {CATEGORIES.map((cat) => {
        const active = selected === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(active ? null : cat.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 min-h-[28px]"
            style={{
              backgroundColor: active ? cat.color : cat.bg,
              color: active ? "#fff" : cat.color,
              border: `1px solid ${active ? cat.color : cat.color}44`,
            }}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CategoryBadge({ category }: { category: string | null | undefined }) {
  if (!category) return null;
  const cat = CATEGORIES.find((c) => c.id === category);
  if (!cat) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
      style={{ backgroundColor: cat.bg, color: cat.color }}
    >
      {cat.emoji} {cat.label}
    </span>
  );
}
