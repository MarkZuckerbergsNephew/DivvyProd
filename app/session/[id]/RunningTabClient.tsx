"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase-browser";
import { useSessionRealtime } from "@/hooks/useSessionRealtime";
import { useToast } from "@/hooks/useToast";
import { logActivity } from "@/lib/activityLog";
import { getParticipantColor } from "@/lib/participantColor";
import ParticipantAvatar from "@/components/ParticipantAvatar";
import ShareSheet from "@/components/ShareSheet";
import { SessionShell } from "@/components/session";
import CategoryChips, { CategoryBadge } from "@/components/running-tab/CategoryChips";
import ActivityFeed from "@/components/running-tab/ActivityFeed";
import BalanceDashboard from "@/components/running-tab/BalanceDashboard";
import SettleUpSheet, { DebtTx } from "@/components/running-tab/SettleUpSheet";
import RecurringExpenses, { Frequency, RecurringExpense } from "@/components/running-tab/RecurringExpenses";
import MonthlySummary from "@/components/running-tab/MonthlySummary";
import NudgeBanner from "@/components/running-tab/NudgeBanner";
import MemberManagement from "@/components/running-tab/MemberManagement";

/* ─────────────── Types ─────────────── */

type RunningTabItem = {
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

type Participant = {
  id: string;
  name: string;
  venmo_username: string | null;
  cashapp_username: string | null;
};

type TabSettlement = {
  id: string;
  from_participant_id: string;
  to_participant_id: string;
  amount: number;
  settled_at: string;
  note: string | null;
};

type Tab = "expenses" | "activity" | "summary" | "members";

/* ─────────────── Balance calculation ─────────────── */

function calculateBalances(
  participants: Participant[],
  items: RunningTabItem[],
  claims: Claim[],
  settlements: TabSettlement[],
): Record<string, number> {
  const b: Record<string, number> = {};
  participants.forEach((p) => { b[p.id] = 0; });

  items.forEach((item) => {
    if (!item.added_by || item.price == null) return;
    b[item.added_by] = (b[item.added_by] ?? 0) + item.price;
  });

  claims.forEach((c) => {
    b[c.participant_id] = (b[c.participant_id] ?? 0) - (c.amount ?? 0);
  });

  settlements.forEach((s) => {
    b[s.from_participant_id] = (b[s.from_participant_id] ?? 0) + s.amount;
    b[s.to_participant_id] = (b[s.to_participant_id] ?? 0) - s.amount;
  });

  Object.keys(b).forEach((k) => { b[k] = Math.round(b[k] * 100) / 100; });
  return b;
}

/* ─────────────── Debt minimization ─────────────── */

function minimizeDebts(balances: Record<string, number>): DebtTx[] {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.01)
    .map(([id, balance]) => ({ id, balance }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.01)
    .map(([id, balance]) => ({ id, balance: -balance }))
    .sort((a, b) => b.balance - a.balance);

  const txs: DebtTx[] = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].balance, debtors[j].balance);
    if (amount > 0.005) {
      txs.push({
        from: debtors[j].id,
        to: creditors[i].id,
        amount: Math.round(amount * 100) / 100,
      });
    }
    creditors[i].balance -= amount;
    debtors[j].balance -= amount;
    if (creditors[i].balance < 0.005) i++;
    if (debtors[j].balance < 0.005) j++;
  }

  return txs;
}

/* ─────────────── Date grouping ─────────────── */

function getDateLabel(dateStr: string): string {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yesterdayStr = yest.toISOString().split("T")[0];
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  if (d >= weekAgo) return "This week";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupItemsByDate(items: RunningTabItem[]) {
  const groups = new Map<string, RunningTabItem[]>();
  const order: string[] = [];
  const sorted = [...items].sort((a, b) => b.item_date.localeCompare(a.item_date));
  for (const item of sorted) {
    const label = getDateLabel(item.item_date);
    if (!groups.has(label)) { groups.set(label, []); order.push(label); }
    groups.get(label)!.push(item);
  }
  return order.map((label) => ({ label, items: groups.get(label)! }));
}

/* ─────────────── Recurring date math ─────────────── */

function computeNextDate(from: string, frequency: Frequency): string {
  const d = new Date(from + "T00:00:00");
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().split("T")[0];
}

/* ─────────────── Tab config ─────────────── */

const TABS: { id: Tab; label: string }[] = [
  { id: "expenses", label: "Expenses" },
  { id: "activity", label: "Activity" },
  { id: "summary", label: "Summary" },
  { id: "members", label: "Members" },
];

/* ─────────────── Component ─────────────── */

export default function RunningTabClient({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const toast = useToast();

  /* Identity */
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [hostParticipantId, setHostParticipantId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("Running Tab");
  const [joinCode, setJoinCode] = useState<string | null>(null);

  /* Data */
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<RunningTabItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tabSettlements, setTabSettlements] = useState<TabSettlement[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  /* UI state */
  const [activeTab, setActiveTab] = useState<Tab>("expenses");
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  /* Add item form */
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addCategory, setAddCategory] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [amountInput, setAmountInput] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const recurringProcessedRef = useRef(false);

  /* ── Participant identity ── */

  useEffect(() => {
    const fromUrl = searchParams.get("participant");
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem(`divvy_session_${sessionId}`)
        : null;
    setParticipantId(fromUrl || saved);
  }, [searchParams, sessionId]);

  useEffect(() => {
    if (participantId && typeof window !== "undefined") {
      localStorage.setItem(`divvy_session_${sessionId}`, participantId);
    }
  }, [participantId, sessionId]);

  useEffect(() => {
    if (!participantId) return;
    supabase
      .from("participants")
      .select("name")
      .eq("id", participantId)
      .single()
      .then(({ data }) => { if (data) setParticipantName(data.name); });
  }, [participantId]);

  /* ── Fetchers ── */

  const fetchSession = useCallback(async () => {
    const { data } = await supabase
      .from("sessions")
      .select("title, host_participant_id, join_code")
      .eq("id", sessionId)
      .single();
    if (!data) return;
    if (data.title) setSessionTitle(data.title);
    setHostParticipantId(data.host_participant_id ?? null);
    setJoinCode((data as { join_code?: string | null }).join_code ?? null);
  }, [sessionId]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("id, name, price, added_by, item_date, category")
      .eq("session_id", sessionId)
      .order("item_date", { ascending: false });
    setItems(data ?? []);
  }, [sessionId]);

  const fetchClaims = useCallback(async () => {
    const { data } = await supabase
      .from("claims")
      .select("id, item_id, participant_id, amount, items!inner(session_id)")
      .eq("items.session_id", sessionId);
    setClaims(data ?? []);
  }, [sessionId]);

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from("participants")
      .select("id, name, venmo_username, cashapp_username")
      .eq("session_id", sessionId);
    setParticipants(data ?? []);
  }, [sessionId]);

  const fetchTabSettlements = useCallback(async () => {
    const { data } = await supabase
      .from("settlements")
      .select("*")
      .eq("session_id", sessionId)
      .order("settled_at", { ascending: false });
    setTabSettlements(data ?? []);
  }, [sessionId]);

  const fetchRecurring = useCallback(async () => {
    const { data } = await supabase
      .from("recurring_expenses")
      .select("id, name, amount, category, frequency, next_date, last_added_at")
      .eq("session_id", sessionId)
      .order("next_date", { ascending: true });
    setRecurringExpenses((data as RecurringExpense[]) ?? []);
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    fetchItems();
    fetchClaims();
    fetchParticipants();
    fetchTabSettlements();
    fetchRecurring();
  }, [fetchSession, fetchItems, fetchClaims, fetchParticipants, fetchTabSettlements, fetchRecurring]);

  /* ── Realtime ── */

  useSessionRealtime(sessionId, {
    onItems: fetchItems,
    onClaims: fetchClaims,
    onParticipants: fetchParticipants,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`tab-settlements-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settlements", filter: `session_id=eq.${sessionId}` },
        fetchTabSettlements,
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchTabSettlements]);

  useEffect(() => {
    const ch = supabase
      .channel(`recurring-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_expenses", filter: `session_id=eq.${sessionId}` },
        fetchRecurring,
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchRecurring]);

  /* ── Presence ── */

  useEffect(() => {
    if (!participantId || !participantName) return;
    const ch = supabase.channel(`presence-tab-${sessionId}`, {
      config: { presence: { key: participantId } },
    });
    ch.on("presence", { event: "sync" }, () => {
      setOnlineIds(Object.keys(ch.presenceState()));
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ participantId, name: participantName });
    });
    return () => { void supabase.removeChannel(ch); };
  }, [participantId, participantName, sessionId]);

  /* ── Process recurring expenses on mount ── */

  useEffect(() => {
    if (recurringProcessedRef.current || recurringExpenses.length === 0 || !participantId) return;
    recurringProcessedRef.current = true;

    const today = new Date().toISOString().split("T")[0];
    const due = recurringExpenses.filter((e) => e.next_date <= today);
    if (due.length === 0) return;

    (async () => {
      for (const exp of due) {
        const { error } = await supabase.from("items").insert({
          session_id: sessionId,
          name: exp.name,
          price: exp.amount,
          added_by: participantId,
          item_date: today,
          category: exp.category,
        });

        if (error) {
          toast.error(`Couldn't auto-add ${exp.name}.`);
          continue;
        }

        const nextDate = computeNextDate(exp.next_date, exp.frequency);
        await supabase
          .from("recurring_expenses")
          .update({ next_date: nextDate, last_added_at: today })
          .eq("id", exp.id);

        const adderName = participantName ?? "Someone";
        await logActivity(
          sessionId,
          participantId,
          "recurring_added",
          `${adderName} auto-added ${exp.name} · $${exp.amount.toFixed(2)}`,
        );

        toast.info(`${exp.name} $${exp.amount.toFixed(2)} was automatically added`);
      }

      await fetchItems();
      await fetchRecurring();
    })();
  }, [recurringExpenses, participantId, sessionId, participantName, toast, fetchItems, fetchRecurring]);

  /* ── Computed ── */

  const isHost = participantId === hostParticipantId;

  const balances = useMemo(
    () => calculateBalances(participants, items, claims, tabSettlements),
    [participants, items, claims, tabSettlements],
  );

  const debtTxs = useMemo(() => minimizeDebts(balances), [balances]);
  const groupedItems = useMemo(() => groupItemsByDate(items), [items]);
  const myBalance = participantId ? (balances[participantId] ?? 0) : 0;

  /* ── Add item ── */

  async function addItem() {
    if (!participantId || !addName.trim()) return;
    const price = parseFloat(addPrice);
    if (isNaN(price) || price < 0) return;
    setAddingItem(true);

    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("items").insert({
      session_id: sessionId,
      name: addName.trim(),
      price,
      added_by: participantId,
      item_date: today,
      category: addCategory,
    });

    setAddingItem(false);
    if (error) { toast.error("Couldn't add item. Please try again."); return; }

    const name = addName.trim();
    const catLabel = addCategory ?? "";
    await logActivity(
      sessionId,
      participantId,
      "item_added",
      `${participantName ?? "Someone"} added ${name} · $${price.toFixed(2)}${catLabel ? ` · ${catLabel}` : ""}`,
    );

    setAddName("");
    setAddPrice("");
    setAddCategory(null);
    nameInputRef.current?.focus();
  }

  /* ── Edit claim amount ── */

  async function commitAmount() {
    if (!editingClaim) return;
    const item = items.find((i) => i.id === editingClaim.item_id);
    if (!item) return;

    const entered = Number(amountInput || 0);
    if (isNaN(entered) || entered < 0) { toast.error("Enter a valid amount."); return; }

    const { data: dbClaims } = await supabase
      .from("claims")
      .select("id, amount")
      .eq("item_id", editingClaim.item_id);

    if (!dbClaims) return;

    const usedByOthers = dbClaims
      .filter((c) => c.id !== editingClaim.id)
      .reduce((sum, c) => sum + (c.amount ?? 0), 0);
    const maxAllowed = (item.price ?? 0) - usedByOthers;

    if (entered > maxAllowed + 0.005) {
      toast.error(`Only $${maxAllowed.toFixed(2)} available for your share.`);
      return;
    }

    const { error } = await supabase
      .from("claims")
      .update({ amount: entered })
      .eq("id", editingClaim.id);

    if (error) { toast.error("Couldn't save amount. Please try again."); return; }

    setEditingClaim(null);
    setAmountInput("");
    await fetchClaims();
  }

  /* ── Toggle claim ── */

  async function redistributeClaims(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.price == null) return;
    const { data: current } = await supabase.from("claims").select("id").eq("item_id", itemId);
    if (!current || current.length === 0) return;
    const even = Math.round((item.price / current.length) * 100) / 100;
    await Promise.all(
      current.map((c) => supabase.from("claims").update({ amount: even }).eq("id", c.id)),
    );
  }

  async function toggleClaim(itemId: string) {
    if (!participantId || claimingIds.has(itemId)) return;
    setClaimingIds((prev) => new Set(prev).add(itemId));

    try {
      const existing = claims.find(
        (c) => c.item_id === itemId && c.participant_id === participantId,
      );
      const item = items.find((i) => i.id === itemId);

      if (existing) {
        const { error } = await supabase.from("claims").delete().eq("id", existing.id);
        if (error) { toast.error("Couldn't remove claim."); return; }
        await logActivity(
          sessionId,
          participantId,
          "claim_removed",
          `${participantName ?? "Someone"} unclaimed ${item?.name ?? "an item"}`,
        );
      } else {
        const { error } = await supabase
          .from("claims")
          .insert({ item_id: itemId, participant_id: participantId, amount: 0 });
        if (error) { toast.error("Couldn't add claim."); return; }
        await logActivity(
          sessionId,
          participantId,
          "claim_made",
          `${participantName ?? "Someone"} claimed ${item?.name ?? "an item"} · $${(item?.price ?? 0).toFixed(2)}`,
        );
      }

      await redistributeClaims(itemId);
      await fetchClaims();
    } finally {
      setClaimingIds((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  }

  /* ── Record settlement ── */

  async function recordSettlement(tx: DebtTx) {
    const { error } = await supabase.from("settlements").insert({
      session_id: sessionId,
      from_participant_id: tx.from,
      to_participant_id: tx.to,
      amount: tx.amount,
    });
    if (error) {
      toast.error("Couldn't record settlement. Please try again.");
      throw error;
    }
    const fromP = participants.find((p) => p.id === tx.from);
    const toP = participants.find((p) => p.id === tx.to);
    await logActivity(
      sessionId,
      tx.from,
      "settlement_recorded",
      `${fromP?.name ?? "Someone"} paid ${toP?.name ?? "someone"} $${tx.amount.toFixed(2)}`,
    );
    toast.success("Payment recorded!");
    await fetchTabSettlements();
  }

  /* ── Recurring expense handlers ── */

  async function handleAddRecurring(data: {
    name: string;
    amount: number;
    category: string | null;
    frequency: Frequency;
    start_date: string;
  }) {
    const { error } = await supabase.from("recurring_expenses").insert({
      session_id: sessionId,
      name: data.name,
      amount: data.amount,
      category: data.category,
      frequency: data.frequency,
      next_date: data.start_date,
      created_by: participantId,
    });
    if (error) { toast.error("Couldn't add recurring expense."); return; }
    await logActivity(
      sessionId,
      participantId,
      "recurring_added",
      `${participantName ?? "Someone"} added recurring expense: ${data.name} · $${data.amount.toFixed(2)} · ${data.frequency}`,
    );
    await fetchRecurring();
    toast.success("Recurring expense added!");
  }

  async function handleDeleteRecurring(id: string) {
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete recurring expense."); return; }
    await fetchRecurring();
    toast.success("Recurring expense removed.");
  }

  /* ── Member management handlers ── */

  async function handleRemoveMember(targetId: string): Promise<string | null> {
    const target = participants.find((p) => p.id === targetId);
    const bal = balances[targetId] ?? 0;
    if (Math.abs(bal) > 0.01) {
      return `${target?.name ?? "This member"} has an unsettled balance of $${Math.abs(bal).toFixed(2)}. Settle up first.`;
    }
    const { error } = await supabase.from("participants").delete().eq("id", targetId);
    if (error) { toast.error("Couldn't remove member."); return "Failed to remove member."; }
    await logActivity(
      sessionId,
      participantId,
      "member_removed",
      `${target?.name ?? "A member"} was removed from the tab`,
    );
    await fetchParticipants();
    toast.success(`${target?.name ?? "Member"} removed.`);
    return null;
  }

  async function handleTransferHost(targetId: string) {
    const { error } = await supabase
      .from("sessions")
      .update({ host_participant_id: targetId })
      .eq("id", sessionId);
    if (error) { toast.error("Couldn't transfer host."); return; }
    const target = participants.find((p) => p.id === targetId);
    await logActivity(
      sessionId,
      participantId,
      "host_transferred",
      `Host transferred to ${target?.name ?? "someone"}`,
    );
    await fetchSession();
    toast.success(`${target?.name ?? "Member"} is now the host.`);
  }

  async function handleLeave(): Promise<string | null> {
    if (!participantId) return null;
    const bal = balances[participantId] ?? 0;
    if (Math.abs(bal) > 0.01) {
      return `You have an unsettled balance of $${Math.abs(bal).toFixed(2)}. Settle up before leaving.`;
    }
    const { error } = await supabase.from("participants").delete().eq("id", participantId);
    if (error) { toast.error("Couldn't leave tab."); return "Failed to leave tab."; }
    if (typeof window !== "undefined") {
      localStorage.removeItem(`divvy_session_${sessionId}`);
      window.location.href = "/";
    }
    return null;
  }

  /* ── Rename tab ── */

  function startEditingTitle() {
    setTitleInput(sessionTitle);
    setEditingTitle(true);
    // focus is handled by autoFocus on the input
  }

  async function saveTitle() {
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === sessionTitle) {
      setEditingTitle(false);
      return;
    }
    const { error } = await supabase
      .from("sessions")
      .update({ title: trimmed })
      .eq("id", sessionId);
    if (error) {
      toast.error("Couldn't rename tab. Please try again.");
      return;
    }
    setSessionTitle(trimmed);
    setEditingTitle(false);
    await logActivity(
      sessionId,
      participantId,
      "tab_renamed",
      `Host renamed the tab to "${trimmed}"`,
    );
  }

  function cancelEditingTitle() {
    setEditingTitle(false);
  }

  /* ── UI helpers ── */

  const nudgeDismissKey = `nudge_${sessionId}_${participantId}`;

  /* ─────────────── RENDER ─────────────── */

  return (
    <SessionShell
      header={
        <div className="max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto px-4 pt-3 pb-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 pb-3">
            <div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">🏠</span>
                {isHost && editingTitle ? (
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <input
                      ref={titleInputRef}
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
                        if (e.key === "Escape") cancelEditingTitle();
                      }}
                      autoFocus
                      className="text-2xl font-bold text-slate-900 tracking-tight bg-transparent border-b-2 border-[var(--accent)] outline-none min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={saveTitle}
                      className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent-dark)] transition-colors"
                      aria-label="Save"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingTitle}
                      className="shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                      aria-label="Cancel"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={isHost ? startEditingTitle : undefined}
                    disabled={!isHost}
                    className={`text-left min-w-0 ${isHost ? "group cursor-pointer" : "cursor-default"}`}
                  >
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap min-w-0">
                      <span className="truncate max-w-[180px] sm:max-w-none">{sessionTitle}</span>
                      {isHost && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-normal text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Rename
                        </span>
                      )}
                    </h1>
                  </button>
                )}
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Running Tab · {participants.length} member{participants.length !== 1 ? "s" : ""}
              </p>
            </div>
            {joinCode && (
              <button
                type="button"
                onClick={() => setShowShareSheet(true)}
                className="shrink-0 min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 active:scale-95 transition-all"
              >
                Share ↗
              </button>
            )}
          </div>

          {/* Tab nav */}
          <div className="flex border-b border-slate-200 -mx-4 px-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap px-1 ${
                  activeTab === tab.id
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
      footer={
        <div className="w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto">
          <button
            type="button"
            onClick={() => setShowSettleUp(true)}
            disabled={debtTxs.length === 0}
            className={`w-full min-h-[52px] rounded-xl font-semibold text-base transition-all duration-150 ${
              debtTxs.length > 0
                ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] shadow-[0_2px_8px_rgba(13,148,136,0.25)] active:scale-[0.98]"
                : "bg-slate-100 text-slate-500 cursor-not-allowed"
            }`}
          >
            {debtTxs.length > 0
              ? `Settle up (${debtTxs.length} transaction${debtTxs.length !== 1 ? "s" : ""})`
              : "All settled up ✓"}
          </button>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="space-y-5 pb-12"
        >
          {/* ─── EXPENSES TAB ─── */}
          {activeTab === "expenses" && (
            <>
              {/* Balance dashboard */}
              <BalanceDashboard
                participants={participants}
                currentParticipantId={participantId}
                debtTxs={debtTxs}
                onSettleUp={() => setShowSettleUp(true)}
              />

              {/* Nudge banner */}
              {participantId && (
                <NudgeBanner
                  balance={myBalance}
                  onSettleUp={() => setShowSettleUp(true)}
                  dismissKey={nudgeDismissKey}
                />
              )}

              {/* Add item form */}
              {participantId ? (
                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      ref={nameInputRef}
                      placeholder="Item name"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); priceInputRef.current?.focus(); }
                      }}
                      className="flex-1 min-w-0 min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white/90 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                    />
                    <input
                      ref={priceInputRef}
                      placeholder="$"
                      value={addPrice}
                      onChange={(e) => setAddPrice(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                      className="w-16 sm:w-20 min-h-[48px] px-2 sm:px-3 rounded-xl border border-slate-200 bg-white/90 text-center placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={addingItem || !addName.trim() || !addPrice}
                      className="min-h-[48px] px-3 sm:px-4 rounded-xl bg-slate-900 text-white font-medium active:scale-[0.98] transition-transform hover:bg-slate-800 disabled:opacity-40 shrink-0"
                    >
                      {addingItem ? (
                        <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                      ) : (
                        "Add"
                      )}
                    </button>
                  </div>
                  {/* Category chips */}
                  <CategoryChips selected={addCategory} onChange={setAddCategory} />
                </div>
              ) : (
                <div className="text-center py-5 space-y-3">
                  <p className="text-sm text-[var(--text-muted)]">
                    You haven&apos;t joined this tab yet.
                  </p>
                  <a
                    href={`/join/${sessionId}`}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all"
                  >
                    Join this tab →
                  </a>
                </div>
              )}

              {/* Recurring expenses */}
              {participantId && (
                <RecurringExpenses
                  expenses={recurringExpenses}
                  onAdd={handleAddRecurring}
                  onDelete={handleDeleteRecurring}
                />
              )}

              {/* Divider */}
              {items.length > 0 && <div className="h-px bg-slate-100" />}

              {/* Items grouped by date */}
              {groupedItems.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-muted)]">
                  <p className="text-4xl mb-3">🏠</p>
                  <p className="font-medium text-slate-700">No expenses yet</p>
                  <p className="text-sm mt-1">Add the first item above</p>
                </div>
              ) : (
                groupedItems.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-1">
                      {group.label}
                    </h3>
                    {group.items.map((item) => {
                      const itemClaims = claims.filter((c) => c.item_id === item.id);
                      const isClaiming = claimingIds.has(item.id);
                      const isClaimed = itemClaims.some((c) => c.participant_id === participantId);
                      const claimedTotal = itemClaims.reduce((sum, c) => sum + (c.amount ?? 0), 0);
                      const remaining = (item.price ?? 0) - claimedTotal;
                      const adder = participants.find((p) => p.id === item.added_by);
                      const dominantName =
                        itemClaims.length > 0
                          ? (participants.find((p) => p.id === itemClaims[0].participant_id)?.name ?? "")
                          : "";
                      const stripeColor = dominantName
                        ? getParticipantColor(dominantName)
                        : "#e2e8f0";

                      return (
                        <motion.div
                          key={item.id}
                          layout
                          className="bg-white rounded-xl border border-slate-200 shadow-[var(--shadow-card)] overflow-hidden"
                        >
                          <div className="flex">
                            <div className="w-1 shrink-0" style={{ backgroundColor: stripeColor }} />
                            <div className="flex-1 p-3 space-y-2.5">
                              {/* Name + price */}
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-slate-900 text-sm leading-tight flex-1 min-w-0">
                                  {item.name}
                                </p>
                                <span className="font-bold text-[var(--accent)] text-sm shrink-0">
                                  ${(item.price ?? 0).toFixed(2)}
                                </span>
                              </div>

                              {/* Added by */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {adder && (
                                  <div className="flex items-center gap-1.5">
                                    <ParticipantAvatar name={adder.name} size="sm" />
                                    <span
                                      className={`text-xs font-medium ${
                                        adder.id === participantId
                                          ? "text-[var(--accent)]"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      Added by{" "}
                                      {adder.id === participantId ? "you" : adder.name}
                                    </span>
                                  </div>
                                )}
                                <CategoryBadge category={item.category} />
                              </div>

                              {/* Claimants row */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    {itemClaims.length > 0 ? (
                                      itemClaims.map((claim) => {
                                        const claimer = participants.find(
                                          (p) => p.id === claim.participant_id,
                                        );
                                        if (!claimer) return null;
                                        return (
                                          <div key={claim.id} className="flex items-center gap-1">
                                            <ParticipantAvatar name={claimer.name} size="sm" />
                                            <span className="text-[10px] text-slate-500 font-medium tabular-nums">
                                              ${(claim.amount ?? 0).toFixed(2)}
                                            </span>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <span className="text-[11px] text-[var(--text-hint)] italic">
                                        Unclaimed
                                      </span>
                                    )}
                                  </div>
                                  {participantId && (
                                    <button
                                      type="button"
                                      onClick={() => toggleClaim(item.id)}
                                      disabled={isClaiming}
                                      className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all active:scale-95 min-h-[28px] min-w-[60px] ${
                                        isClaimed
                                          ? "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600"
                                          : "bg-[var(--accent-light)] text-[var(--accent)] hover:bg-teal-100"
                                      }`}
                                    >
                                      {isClaiming ? "…" : isClaimed ? "Unclaim" : "Claim"}
                                    </button>
                                  )}
                                </div>

                                {/* Claim status badge */}
                                {itemClaims.length > 0 && (
                                  remaining > 0.01 ? (
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                                      <span>⚠</span>
                                      <span>${remaining.toFixed(2)} unclaimed</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                      <span>✓</span>
                                      <span>Fully claimed</span>
                                    </div>
                                  )
                                )}

                                {/* Edit your share — only visible to current user when they have a claim */}
                                {isClaimed && participantId && (() => {
                                  const myClaim = itemClaims.find(
                                    (c) => c.participant_id === participantId,
                                  );
                                  if (!myClaim) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingClaim(myClaim);
                                        setAmountInput(
                                          myClaim.amount != null ? String(myClaim.amount) : "",
                                        );
                                      }}
                                      className="w-full min-h-[44px] flex items-center justify-center gap-1 text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-dark)] hover:bg-teal-50 rounded-lg transition-colors"
                                    >
                                      Edit your share →
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ))
              )}
            </>
          )}

          {/* ─── ACTIVITY TAB ─── */}
          {activeTab === "activity" && (
            <ActivityFeed sessionId={sessionId} participants={participants} />
          )}

          {/* ─── SUMMARY TAB ─── */}
          {activeTab === "summary" && (
            <MonthlySummary
              items={items}
              claims={claims}
              participants={participants}
              settlements={tabSettlements}
              sessionTitle={sessionTitle}
            />
          )}

          {/* ─── MEMBERS TAB ─── */}
          {activeTab === "members" && (
            <MemberManagement
              participants={participants}
              balances={balances}
              hostParticipantId={hostParticipantId}
              currentParticipantId={participantId}
              isHost={isHost}
              sessionId={sessionId}
              joinCode={joinCode}
              onRemove={handleRemoveMember}
              onTransferHost={handleTransferHost}
              onLeave={handleLeave}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ─── Settle up sheet ─── */}
      <SettleUpSheet
        isOpen={showSettleUp}
        onClose={() => setShowSettleUp(false)}
        debtTxs={debtTxs}
        participants={participants}
        settlements={tabSettlements}
        currentParticipantId={participantId}
        isHost={isHost}
        sessionTitle={sessionTitle}
        onSettle={recordSettlement}
      />

      {/* ─── Share sheet ─── */}
      {joinCode && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          sessionId={sessionId}
          joinCode={joinCode}
        />
      )}

      {/* ─── Edit claim amount sheet ─── */}
      {editingClaim && (() => {
        const item = items.find((i) => i.id === editingClaim.item_id);
        if (!item) return null;
        const otherClaims = claims.filter(
          (c) => c.item_id === editingClaim.item_id && c.id !== editingClaim.id,
        );
        const usedByOthers = otherClaims.reduce((sum, c) => sum + (c.amount ?? 0), 0);
        const maxAllowed = Math.max(0, (item.price ?? 0) - usedByOthers);
        return (
          <div
            className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
            onClick={() => { setEditingClaim(null); setAmountInput(""); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
              <div className="text-center space-y-0.5">
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  Total ${(item.price ?? 0).toFixed(2)}
                  {otherClaims.length > 0 && ` · $${maxAllowed.toFixed(2)} available`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-medium text-slate-600">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max={maxAllowed}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitAmount(); }}
                  autoFocus
                  placeholder="0.00"
                  className="w-32 text-3xl font-bold text-center text-slate-900 border-b-2 border-[var(--accent)] bg-transparent outline-none py-1"
                />
              </div>
              <button
                type="button"
                onClick={commitAmount}
                className="w-full min-h-[52px] rounded-xl bg-[var(--accent)] text-white font-semibold text-base hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all"
              >
                Save my share
              </button>
              <button
                type="button"
                onClick={() => { setEditingClaim(null); setAmountInput(""); }}
                className="w-full text-sm text-[var(--text-muted)] py-1"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        );
      })()}
    </SessionShell>
  );
}
