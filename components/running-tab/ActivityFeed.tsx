"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";
import ParticipantAvatar from "@/components/ParticipantAvatar";

export type ActivityEntry = {
  id: string;
  participant_id: string | null;
  type: string;
  message: string;
  created_at: string;
};

type Participant = { id: string; name: string };

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 60) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACTION_ICONS: Record<string, string> = {
  item_added: "➕",
  item_deleted: "🗑️",
  claim_made: "✋",
  claim_removed: "↩️",
  settlement_recorded: "💸",
  member_joined: "👋",
  recurring_added: "🔄",
  host_transferred: "👑",
  member_removed: "👤",
};

const PAGE_SIZE = 50;

type Props = {
  sessionId: string;
  participants: Participant[];
};

export default function ActivityFeed({ sessionId, participants }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(
    async (pageOffset: number, replace: boolean) => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, participant_id, type, message, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .range(pageOffset, pageOffset + PAGE_SIZE - 1);
      const rows = data ?? [];
      setEntries((prev) => (replace ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    },
    [sessionId],
  );

  useEffect(() => {
    fetchPage(0, true);

    const channel = supabase
      .channel(`activity-feed-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `session_id=eq.${sessionId}` },
        () => fetchPage(0, true),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchPage]);

  function loadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchPage(next, false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-teal-500 animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)]">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-medium text-slate-700">No activity yet</p>
        <p className="text-sm mt-1">Actions will appear here as they happen</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {entries.map((entry) => {
        const participant = entry.participant_id
          ? participants.find((p) => p.id === entry.participant_id)
          : null;
        const icon = ACTION_ICONS[entry.type] ?? "📌";

        return (
          <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
            <div className="shrink-0">
              {participant ? (
                <ParticipantAvatar name={participant.name} size="md" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-base">
                  {icon}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 leading-snug">{entry.message}</p>
              <p className="text-[11px] text-[var(--text-hint)] mt-0.5">
                {relativeTime(entry.created_at)}
              </p>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="w-full py-3 text-sm text-[var(--accent)] font-medium hover:text-[var(--accent-dark)] transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  );
}
