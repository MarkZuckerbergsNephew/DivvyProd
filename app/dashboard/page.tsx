import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getParticipantColor, getInitials } from "@/lib/participantColor";
import Link from "next/link";

interface SessionRow {
  id: string;
  title: string;
  status: string;
  split_mode: string;
  created_at: string;
  join_code: string | null;
}

interface ParticipantRow {
  id: string;
  name: string;
  session_id: string;
  sessions: SessionRow;
}

interface SessionParticipant {
  id: string;
  name: string;
  session_id: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-teal-50 text-teal-700 border-teal-200" },
    reviewing: { label: "Reviewing", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    completed: { label: "Completed", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active" ? "bg-teal-400" :
    status === "reviewing" ? "bg-amber-400" :
    "bg-slate-300";
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />;
}

function MemberAvatars({ members }: { members: SessionParticipant[] }) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <div
            key={m.id}
            title={m.name}
            className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
            style={{ backgroundColor: getParticipantColor(m.name) }}
          >
            {getInitials(m.name)}
          </div>
        ))}
        {extra > 0 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 text-[8px] font-bold">
            +{extra}
          </div>
        )}
      </div>
      <span className="text-xs text-[var(--text-muted)]">
        {members.length} member{members.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.display_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "there";

  const { data: participantRows } = await supabase
    .from("participants")
    .select("id, name, session_id, sessions(id, title, status, split_mode, created_at, join_code)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });


  const sessions: SessionRow[] = [];
  const seen = new Set<string>();

  (participantRows as ParticipantRow[] | null ?? []).forEach((p) => {
    if (p.sessions && !seen.has(p.sessions.id)) {
      seen.add(p.sessions.id);
      sessions.push(p.sessions);
    }
  });

  const sessionIds = sessions.map((s) => s.id);
  const participantsBySession: Record<string, SessionParticipant[]> = {};

  if (sessionIds.length > 0) {
    const { data: allParticipants } = await supabase
      .from("participants")
      .select("id, name, session_id")
      .in("session_id", sessionIds);

    (allParticipants ?? []).forEach((p) => {
      if (!participantsBySession[p.session_id]) participantsBySession[p.session_id] = [];
      participantsBySession[p.session_id].push({ id: p.id, name: p.name, session_id: p.session_id });
    });
  }

  const runningTabs = sessions.filter((s) => s.split_mode === "running_tab");
  const quickSplits = sessions.filter((s) => s.split_mode !== "running_tab");

  return (
    <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight truncate">
            Hey, {displayName} 👋
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Your splits and running tabs</p>
        </div>
        <Link
          href="/create"
          className="shrink-0 min-h-[44px] px-4 flex items-center rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(13,148,136,0.2)]"
        >
          + New split
        </Link>
      </div>

      {/* Running Tabs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Running Tabs
        </h2>
        {runningTabs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-8 text-center space-y-3">
            <p className="text-2xl">🏠</p>
            <div>
              <p className="text-[var(--text)] font-semibold">No running tabs yet</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Track shared expenses over time — great for roommates and trips.
              </p>
            </div>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all"
            >
              Create your first Running Tab
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {runningTabs.map((s) => {
              const members = participantsBySession[s.id] ?? [];
              return (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] p-5 hover:shadow-[var(--shadow-elevated)] hover:border-[var(--border-strong)] transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusDot status={s.status} />
                        <span className="text-base font-semibold text-[var(--text)] truncate">{s.title}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <MemberAvatars members={members} />
                      <p className="text-xs text-[var(--text-muted)]">
                        Last activity {formatDate(s.created_at)}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-[var(--text-hint)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Splits */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Recent Splits
        </h2>
        {quickSplits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-8 text-center space-y-3">
            <p className="text-2xl">🍽️</p>
            <div>
              <p className="text-[var(--text)] font-semibold">No splits yet</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Split a restaurant bill or group expense in seconds.
              </p>
            </div>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all"
            >
              Start a split
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {quickSplits.slice(0, 10).map((s) => {
              const members = participantsBySession[s.id] ?? [];
              return (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] px-5 py-4 hover:shadow-[var(--shadow-elevated)] hover:border-[var(--border-strong)] transition-all active:scale-[0.99]"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: getParticipantColor(s.title) }}
                  >
                    {getInitials(s.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text)] truncate">{s.title}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {formatDate(s.created_at)}
                      {members.length > 0 && (
                        <> · {members.length} participant{members.length !== 1 ? "s" : ""}</>
                      )}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-hint)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
