"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { calculateTotals } from "@/lib/billMath";
import { useSessionRealtime } from "@/hooks/useSessionRealtime";
import { useToast } from "@/hooks/useToast";
import { motion } from "framer-motion";
import ShareSheet from "@/components/ShareSheet";
import { getParticipantColor, getInitials } from "@/lib/participantColor";
import {
  SessionShell,
  BillSummaryCard,
  TaxTipInputs,
  ItemList,
  SettlementPanel,
  ScanReceiptModal,
} from "@/components/session";

/* ================= TYPES ================= */

type Item = {
  id: string;
  name: string;
  price: number | null;
  category?: string | null;
};

type Claim = {
  id: string;
  item_id: string;
  participant_id: string;
  amount?: number;
};

type Participant = {
  id: string;
  name: string;
  venmo_username?: string | null;
  cashapp_username?: string | null;
};

type SettlementRow = {
  fromId: string;
  from: string;
  toId: string;
  to: string;
  amount: number;
};

/* ================= UTILITIES ================= */

function getAvatarColor(id: string) {
  const colors = [
    "bg-red-400",
    "bg-orange-400",
    "bg-amber-400",
    "bg-green-400",
    "bg-emerald-400",
    "bg-teal-400",
    "bg-sky-400",
    "bg-blue-400",
    "bg-indigo-400",
    "bg-purple-400",
    "bg-pink-400",
  ];

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function clampMoney(value: number) {
  if (isNaN(value) || value < 0) return 0;
  return value;
}

const RESTAURANT_CATS = [
  { id: "food",    label: "Food",    emoji: "🍔" },
  { id: "drinks",  label: "Drinks",  emoji: "🥤" },
  { id: "dessert", label: "Dessert", emoji: "🍰" },
  { id: "other",   label: "Other",   emoji: "📦" },
];

const GENERAL_CATS = [
  { id: "transport",     label: "Transport",     emoji: "🚗" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "food",          label: "Food",          emoji: "🍕" },
  { id: "supplies",      label: "Supplies",      emoji: "🛒" },
  { id: "other",         label: "Other",         emoji: "📦" },
];

const CAT_COLOR: Record<string, { color: string; bg: string }> = {
  food:          { color: "#F97316", bg: "#FFF7ED" },
  drinks:        { color: "#3B82F6", bg: "#EFF6FF" },
  dessert:       { color: "#EC4899", bg: "#FDF2F8" },
  transport:     { color: "#3B82F6", bg: "#EFF6FF" },
  entertainment: { color: "#EC4899", bg: "#FDF2F8" },
  supplies:      { color: "#22C55E", bg: "#F0FDF4" },
  utilities:     { color: "#F59E0B", bg: "#FFFBEB" },
  other:         { color: "#6B7280", bg: "#F3F4F6" },
};

/* ================= CIRCULAR PROGRESS ================= */

function CircularProgress({
  percent,
  allClaimed,
  totalItems,
  claimedItems,
}: {
  percent: number;
  allClaimed: boolean;
  totalItems: number;
  claimedItems: number;
}) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="64" height="64" viewBox="0 0 64 64" className="w-14 h-14 sm:w-16 sm:h-16">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke="#0d9488" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text x="32" y="32" textAnchor="middle" dominantBaseline="central"
          fontSize="12" fontWeight="700" fill={allClaimed ? "#0d9488" : "#0f172a"}>
          {allClaimed ? "✓" : percent > 0 ? `${percent}%` : ""}
        </text>
      </svg>
      <div className="text-center">
        {totalItems === 0 ? (
          <p className="text-[10px] font-medium text-slate-500 leading-tight">No items yet</p>
        ) : allClaimed ? (
          <p className="text-[10px] font-semibold text-teal-600 leading-tight">All claimed!</p>
        ) : percent === 0 ? (
          <p className="text-[10px] font-semibold text-slate-600 leading-tight">Nothing claimed yet</p>
        ) : (
          <>
            <p className="text-[10px] font-semibold text-slate-700 leading-tight">{claimedItems} of {totalItems} items</p>
            <p className="text-[10px] text-slate-500 leading-tight">claimed</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= COMPONENT ================= */

export default function SessionClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  /* ================= STATE ================= */
  
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<string[]>([]);

  const [hostParticipantId, setHostParticipantId] =
    useState<string | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [splitType, setSplitType] =
    useState<"restaurant" | "general" | null>(null);
  const [splitMode, setSplitMode] =
    useState<"quick" | "running_tab">("quick");
  // restaurant adjustments (USER INPUT STRINGS)
  const [taxInput, setTaxInput] = useState("");
  const [tipInput, setTipInput] = useState("");

  const [sessionTitle, setSessionTitle] = useState("Divvy Split");
  const [joinCode, setJoinCode] = useState<string | null>(null);

  // derived numeric values for math (from input strings)
  const taxAmount = Math.max(0, Number(taxInput) || 0);
  const tipAmount = Math.max(0, Number(tipInput) || 0);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [sharing, setSharing] = useState(false);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const itemInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(sessionTitle);

  const [lastClaimedItem, setLastClaimedItem] =
    useState<string | null>(null);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [claimingItemIds, setClaimingItemIds] = useState<Set<string>>(
    new Set()
  );

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const [showPaymentEditSheet, setShowPaymentEditSheet] = useState(false);
  const [editVenmoInput, setEditVenmoInput] = useState("");
  const [editCashAppInput, setEditCashAppInput] = useState("");

  /* ================= INVITE ================= */

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${sessionId}`
      : "";

  async function shareInvite() {
    if (!navigator.share || sharing) return;

    try {
      setSharing(true);
      await navigator.share({
        title: "Join my Divvy split",
        text: "Join our bill split on Divvy!",
        url: inviteLink,
      });
    } finally {
      setSharing(false);
    }
  }

  /* ================= PARTICIPANT ================= */

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
      .then(({ data }) => {
        if (data) setParticipantName(data.name);
      });
  }, [participantId]);

  /* ================= FETCHERS ================= */

  async function fetchSession() {
    const { data } = await supabase
      .from("sessions")
      .select(
        "title, host_participant_id, split_type, split_mode, status, tax_amount, tip_amount, join_code"
      )
      .eq("id", sessionId)
      .single();

    if (!data) return;

    setHostParticipantId(data.host_participant_id);
    if (data.title) setSessionTitle(data.title);
    setStatus((data as { status?: string }).status ?? "active");
    setSplitType((data as { split_type?: "restaurant" | "general" }).split_type ?? null);
    setSplitMode((data as { split_mode?: "quick" | "running_tab" }).split_mode ?? "quick");
    setJoinCode((data as { join_code?: string | null }).join_code ?? null);
    const tax = (data as { tax_amount?: number }).tax_amount;
    const tip = (data as { tip_amount?: number }).tip_amount;
    setTaxInput(tax != null && tax !== 0 ? String(tax) : "");
    setTipInput(tip != null && tip !== 0 ? String(tip) : "");
  }

  async function fetchItems() {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("session_id", sessionId);

    setItems(data ?? []);
  }

  async function fetchParticipants() {
    const { data } = await supabase
      .from("participants")
      .select("id, name, venmo_username, cashapp_username")
      .eq("session_id", sessionId);

    setParticipants(data ?? []);
  }

  async function fetchClaims() {
    const { data } = await supabase
      .from("claims")
      .select(`
        id,
        item_id,
        participant_id,
        amount,
        items!inner(session_id)
      `)
      .eq("items.session_id", sessionId);

    setClaims(data ?? []);
  }

  useEffect(() => {
    fetchSession();
    fetchItems();
    fetchClaims();
    fetchParticipants();

    (async () => {
      const { data: paymentData } = await supabase
        .from("payments")
        .select("participant_id")
        .eq("session_id", sessionId);
      if (paymentData) {
        setPaidIds(paymentData.map((p: { participant_id: string }) => p.participant_id));
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    setTitleInput(sessionTitle);
  }, [sessionTitle]);

  useEffect(() => {
    if (status === "completed") {
      setShowCompletion(true);
    }
  }, [status]);

  useEffect(() => {
    if (items.length === 0) {
      itemInputRef.current?.focus();
    }
  }, [items.length]);

  /* ================= REALTIME ================= */

  useSessionRealtime(sessionId, {
    onItems: fetchItems,
    onClaims: fetchClaims,
    onParticipants: fetchParticipants,
    onPayments: async () => {
      const { data } = await supabase
        .from("payments")
        .select("participant_id")
        .eq("session_id", sessionId);
      if (data) {
        setPaidIds(data.map((p: { participant_id: string }) => p.participant_id));
      }
    },
    onSessionUpdate: payload => {
      const updated = payload.new;
      if (updated.status) {
        setStatus(updated.status);
        if (updated.status === "completed") {
          setShowCompletion(true);
        }
      }
      if (updated.tax_amount !== undefined) {
        setTaxInput(updated.tax_amount ? String(updated.tax_amount) : "");
      }
      if (updated.tip_amount !== undefined) {
        setTipInput(updated.tip_amount ? String(updated.tip_amount) : "");
      }
    },
  });

  /* ================= PRESENCE ================= */

  useEffect(() => {
    if (!participantId || !participantName) return;

    const channel = supabase.channel(`presence-${sessionId}`, {
      config: { presence: { key: participantId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineIds(Object.keys(state));
    });

    channel.subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          participantId,
          name: participantName,
        });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [participantId, participantName, sessionId]);

  /* ================= CLAIM ================= */

  function normalizeWeights(claimers: Claim[]) {
    const total = claimers.reduce(
      (sum, c) => sum + (c.amount ?? 0),
      0
    );

    if (total === 0) return claimers;

    return claimers.map(c => ({
      ...c,
      amount: ((c.amount ?? 0) / total) * 100,
    }));
  }

  async function normalizeItemWeights(itemId: string) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const { data: claimers } = await supabase
      .from("claims")
      .select("id")
      .eq("item_id", itemId);

    if (!claimers || claimers.length === 0) return;

    const even = Math.round(((item.price ?? 0) / claimers.length) * 100) / 100;

    await Promise.all(
      claimers.map(c =>
        supabase
          .from("claims")
          .update({ amount: even })
          .eq("id", c.id)
      )
    );
  }

  async function toggleClaim(itemId: string) {
    if (!participantId || status === "completed") return;

    if (claimingItemIds.has(itemId)) return;

    setClaimingItemIds(prev => new Set(prev).add(itemId));

    try {
      const existing = claims.find(
        c =>
          c.item_id === itemId &&
          c.participant_id === participantId
      );

      if (existing) {
        setClaims(prev => prev.filter(c => c.id !== existing.id));

        const { error } = await supabase
          .from("claims")
          .delete()
          .eq("id", existing.id);

        if (error) {
          setClaims(prev => [...prev, existing]);
          toast.error("Couldn't remove claim. Please try again.");
        }
      } else {
        const tempId = crypto.randomUUID();

        setClaims(prev => [
          ...prev,
          {
            id: tempId,
            item_id: itemId,
            participant_id: participantId,
            amount: 0,
          },
        ]);

        const { data, error } = await supabase
          .from("claims")
          .insert({
            item_id: itemId,
            participant_id: participantId,
            amount: 0,
          })
          .select()
          .single();

        if (error) {
          setClaims(prev => prev.filter(c => c.id !== tempId));
          toast.error("Couldn't add claim. Please try again.");
        }

        if (data) {
          setClaims(prev =>
            prev.map(c => (c.id === tempId ? data : c))
          );
        }
      }
    } finally {
      setClaimingItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  /* ================= ADD ITEM ================= */

  async function addItem() {
    if (status === "completed") return;
    const numericPrice = Number(price);
    if (!name.trim() || isNaN(numericPrice)) return;

    const { error } = await supabase.from("items").insert({
      session_id: sessionId,
      name: name.trim(),
      price: numericPrice,
      category: selectedCategory,
    });

    if (error) {
      toast.error("Couldn't add item. Please try again.");
      return;
    }
    fetchItems();
    setName("");
    setPrice("");
    setSelectedCategory(null);
    itemInputRef.current?.focus();
  }

  async function addItemsFromScan(items: { name: string; price: number }[]) {
    if (status === "completed") return;
    for (const it of items) {
      const { error } = await supabase.from("items").insert({
        session_id: sessionId,
        name: it.name.trim(),
        price: it.price,
      });
      if (error) throw error;
    }
    fetchItems();
  }

  async function extractItemsFromFile(file: File): Promise<{ name: string; price: number }[]> {
    const formData = new FormData();
    formData.set("image", file);
    const res = await fetch("/api/ocr", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to read receipt");
    }
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  }

  async function updateSessionTitle() {
    if (!titleInput.trim()) return;

    const { error } = await supabase
      .from("sessions")
      .update({ title: titleInput.trim() })
      .eq("id", sessionId);

    if (error) {
      toast.error("Couldn't update title. Please try again.");
      return;
    }
    setSessionTitle(titleInput.trim());
    setEditingTitle(false);
  }

  async function setSplitPreset(
    itemId: string,
    type: "even" | "more" | "less"
  ) {
    if (!participantId) return;

    const claimers = claims.filter(c => c.item_id === itemId);
    if (claimers.length !== 2) return;

    const me = claimers.find(
      c => c.participant_id === participantId
    );
    const other = claimers.find(
      c => c.participant_id !== participantId
    );

    if (!me || !other) return;

    let myWeight = 50;
    let otherWeight = 50;

    if (type === "more") {
      myWeight = 80;
      otherWeight = 20;
    }

    if (type === "less") {
      myWeight = 20;
      otherWeight = 80;
    }

    await supabase
      .from("claims")
      .update({ amount: myWeight })
      .eq("id", me.id);

    await supabase
      .from("claims")
      .update({ amount: otherWeight })
      .eq("id", other.id);
  }

  function getRemainingAmount(itemId: string) {
    const item = items.find(i => i.id === itemId);
    if (!item) return 0;

    const claimers = claims.filter(c => c.item_id === itemId);
    const used = claimers.reduce(
      (sum, c) => sum + (c.amount ?? 0),
      0
    );

    return Math.max(0, (item.price ?? 0) - used);
  }

  async function claimRemaining(itemId: string) {
    if (!participantId || status === "completed") return;
    const remaining = getRemainingAmount(itemId);
    if (remaining <= 0) return;
    if (claimingItemIds.has(itemId)) return;

    setClaimingItemIds(prev => new Set(prev).add(itemId));

    try {
      const existing = claims.find(
        c => c.item_id === itemId && c.participant_id === participantId
      );
      const newAmount = (existing?.amount ?? 0) + remaining;

      if (existing) {
        const { error } = await supabase
          .from("claims")
          .update({ amount: newAmount })
          .eq("id", existing.id);

        if (error) {
          toast.error("Couldn't update claim. Please try again.");
          return;
        }
        setClaims(prev =>
          prev.map(c =>
            c.id === existing.id ? { ...c, amount: newAmount } : c
          )
        );
      } else {
        const { data, error } = await supabase
          .from("claims")
          .insert({
            item_id: itemId,
            participant_id: participantId,
            amount: newAmount,
          })
          .select()
          .single();

        if (error) {
          toast.error("Couldn't add claim. Please try again.");
          return;
        }
        if (data) {
          setClaims(prev => [...prev, data as Claim]);
        }
      }
      setLastClaimedItem(itemId);
      setTimeout(() => setLastClaimedItem(null), 1200);
    } finally {
      setClaimingItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  async function commitAmount(claim: Claim) {
    const item = items.find(i => i.id === claim.item_id);
    if (!item) return;

    const entered = Number(amountInput || 0);

    if (isNaN(entered) || entered < 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    // fetch latest claims from database
    const { data: dbClaims } = await supabase
      .from("claims")
      .select("id, amount")
      .eq("item_id", claim.item_id);

    if (!dbClaims) return;

    const others = dbClaims.filter(c => c.id !== claim.id);

    const usedByOthers = others.reduce(
      (sum, c) => sum + (c.amount ?? 0),
      0
    );

    const maxAllowed = (item.price ?? 0) - usedByOthers;

    if (entered > maxAllowed) {
      toast.error(`Only $${maxAllowed.toFixed(2)} remaining for this item.`);
      return;
    }

    const { error } = await supabase
      .from("claims")
      .update({ amount: entered })
      .eq("id", claim.id);

    if (error) {
      toast.error("Couldn't save amount. Please try again.");
      return;
    }

    setEditingClaim(null);
    setAmountInput("");
  }

  /* ================= MARK PAID ================= */

  async function markPaid(pId: string) {
    // Host can mark anyone; debtor can mark themselves
    const canMark = isHost || participantId === pId;
    if (!canMark || status === "completed") return;

    const { error } = await supabase
      .from("payments")
      .upsert(
        {
          session_id: sessionId,
          participant_id: pId,
        },
        { onConflict: "session_id,participant_id" }
      );

    if (error) {
      toast.error("Couldn't record payment. Please try again.");
      return;
    }

    setPaidIds(prev =>
      prev.includes(pId) ? prev : [...prev, pId]
    );
  }

  /* ⭐ NEW — BILL SUMMARY */

  const billSummary = useMemo(() => {
    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.price ?? 0),
      0
    );

    const claimedItems = new Set(claims.map(c => c.item_id));

    const claimedTotal = items
      .filter(i => claimedItems.has(i.id))
      .reduce((s, i) => s + Number(i.price ?? 0), 0);

    const total = subtotal + taxAmount + tipAmount;

    return {
      subtotal,
      claimedTotal,
      remaining: Math.max(0, subtotal - claimedTotal),
      total,
    };
  }, [items, claims, taxAmount, tipAmount]);

  const splitProgress = useMemo(() => {
    if (!items.length) {
      return {
        percent: 0,
        unclaimedCount: 0,
        allClaimed: false,
        claimedCount: 0,
        totalItems: 0,
      };
    }

    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.price ?? 0),
      0
    );
    if (subtotal <= 0) {
      return {
        percent: 100,
        unclaimedCount: 0,
        allClaimed: true,
        claimedCount: items.length,
        totalItems: items.length,
      };
    }

    // Total $ claimed across all claims
    const totalClaimedAmount = claims.reduce(
      (sum, c) => sum + Number(c.amount ?? 0),
      0
    );
    const percent = Math.round(
      Math.min(100, (totalClaimedAmount / subtotal) * 100)
    );

    // Count items that still have remaining $ to claim (with tiny epsilon for float)
    const epsilon = 0.005;
    const unclaimedCount = items.filter((i) => {
      const itemTotal = Number(i.price ?? 0);
      const claimedOnItem = claims
        .filter((c) => c.item_id === i.id)
        .reduce((s, c) => s + Number(c.amount ?? 0), 0);
      return itemTotal - claimedOnItem > epsilon;
    }).length;

    return {
      percent,
      unclaimedCount,
      allClaimed: unclaimedCount === 0,
      claimedCount: items.length - unclaimedCount,
      totalItems: items.length,
    };
  }, [items, claims]);

  /* ================= TOTALS ================= */

  const totals = useMemo(
    () =>
      calculateTotals(
        items,
        claims,
        participants,
        taxAmount,
        tipAmount
      ),
    [items, claims, participants, taxAmount, tipAmount]
  );

  /* ================= SETTLEMENT ================= */

  const settlements: SettlementRow[] = useMemo(() => {
    if (!hostParticipantId) return [];

    const host = participants.find(p => p.id === hostParticipantId);
    if (!host) return [];

    return participants
      .filter(p => p.id !== hostParticipantId)
      .filter(p => totals[p.id] > 0)
      .map(p => ({
        fromId: p.id,
        from: p.name,
        toId: host.id,
        to: host.name,
        amount: totals[p.id],
      }))
      .sort((a, b) => {
        const aPaid = paidIds.includes(a.fromId);
        const bPaid = paidIds.includes(b.fromId);

        if (aPaid === bPaid) return 0;
        return aPaid ? 1 : -1; // unpaid first
      });
  }, [participants, totals, hostParticipantId, paidIds]);

  function createVenmoLink(amount: number, venmoUsername?: string | null) {
    const params = `txn=pay&amount=${amount.toFixed(2)}&note=Divvy%20Split`;
    if (venmoUsername?.trim()) {
      return `https://venmo.com/${encodeURIComponent(venmoUsername.trim())}?${params}`;
    }
    return `https://venmo.com/?${params}`;
  }

  const host = participants.find(p => p.id === hostParticipantId);

  function generatePaymentLink(sId: string, participantId: string): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/pay/${sId}/${participantId}`;
  }

  function copyPaymentRequest(fromId: string, amount: number) {
    const link = generatePaymentLink(sessionId, fromId);
    const text = `You owe $${amount.toFixed(2)} for our split.\n\nPay here:\n${link}`;
    void navigator.clipboard.writeText(text);
  }

  async function exportPDF() {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const fileDate = new Date().toISOString().split("T")[0];
    const safeTitle = sessionTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase();

    // ── Header ──
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Divvy", 14, 18);
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    doc.text(sessionTitle, 14, 27);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(dateStr, 14, 34);
    doc.setTextColor(0, 0, 0);

    // ── Section 1: Items ──
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Items", 14, 44);

    const itemRows = items.map((item) => {
      const itemClaims = claims.filter((c) => c.item_id === item.id);
      const claimerStr = itemClaims.length > 0
        ? itemClaims
            .map((c) => {
              const p = participants.find((p) => p.id === c.participant_id);
              return `${p?.name ?? "?"}: $${(c.amount ?? 0).toFixed(2)}`;
            })
            .join(", ")
        : "Unclaimed";
      return [item.name, `$${Number(item.price ?? 0).toFixed(2)}`, claimerStr];
    });

    autoTable(doc, {
      startY: 48,
      head: [["Item", "Price", "Claims"]],
      body: itemRows,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [13, 148, 136] },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 25 }, 2: { cellWidth: "auto" } },
    });

    // ── Section 2: Per-person summary ──
    const subtotal = items.reduce((s, i) => s + Number(i.price ?? 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let y: number = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Per-person summary", 14, y);

    const personRows = participants.map((p) => {
      const foodTotal = claims
        .filter((c) => c.participant_id === p.id)
        .reduce((s, c) => s + (c.amount ?? 0), 0);
      const ratio = subtotal > 0 ? foodTotal / subtotal : 0;
      const taxShare = ratio * taxAmount;
      const tipShare = ratio * tipAmount;
      const total = foodTotal + taxShare + tipShare;
      return [
        p.name,
        `$${foodTotal.toFixed(2)}`,
        `$${taxShare.toFixed(2)}`,
        splitType === "restaurant" ? `$${tipShare.toFixed(2)}` : "—",
        `$${total.toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: y + 4,
      head: [["Name", "Food", "Tax", "Tip", "Total"]],
      body: personRows,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [13, 148, 136] },
    });

    // ── Section 3: Settlement ──
    if (settlements.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Settlement", 14, y);

      autoTable(doc, {
        startY: y + 4,
        head: [["Pays", "To", "Amount"]],
        body: settlements.map((s) => [s.from, s.to, `$${s.amount.toFixed(2)}`]),
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [13, 148, 136] },
      });
    }

    // ── Footer ──
    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text("Generated by Divvy", 14, pageH - 10);

    doc.save(`divvy-${safeTitle}-${fileDate}.pdf`);
  }

  function copyAllPaymentRequests() {
    const lines = settlements.map(s => {
      const link = generatePaymentLink(sessionId, s.fromId);
      return `${s.from}: You owe $${s.amount.toFixed(2)} for our split. Pay here: ${link}`;
    });
    void navigator.clipboard.writeText(lines.join("\n\n"));
  }

  const isHost = participantId === hostParticipantId;

  // debounced auto-save tax/tip (host only)
  useEffect(() => {
    if (!isHost) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from("sessions")
        .update({
          tax_amount: taxAmount,
          tip_amount: tipAmount,
        })
        .eq("id", sessionId);
    }, 700);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [taxAmount, tipAmount, isHost, sessionId]);

  async function startReview() {
    setStatus("reviewing");
    const { error } = await supabase
      .from("sessions")
      .update({ status: "reviewing" })
      .eq("id", sessionId);

    if (error) {
      setStatus("active");
      toast.error("Couldn't start review. Please try again.");
    }
  }

  async function confirmSplit() {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);

    if (error) {
      toast.error("Couldn't confirm split. Please try again.");
      return;
    }
    setStatus("completed");
    setShowCompletion(true);
  }

  async function reopenSplit() {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "active" })
      .eq("id", sessionId);

    if (error) {
      toast.error("Couldn't reopen split. Please try again.");
      return;
    }
    setStatus("active");
  }

  function openPaymentEditSheet() {
    setEditVenmoInput(host?.venmo_username ?? "");
    setEditCashAppInput(host?.cashapp_username ?? "");
    setShowPaymentEditSheet(true);
  }

  async function savePaymentInfo() {
    if (!hostParticipantId) return;

    const { error } = await supabase
      .from("participants")
      .update({
        venmo_username: editVenmoInput.trim() || null,
        cashapp_username: editCashAppInput.trim() || null,
      })
      .eq("id", hostParticipantId);

    if (error) {
      toast.error("Couldn't save payment info. Please try again.");
      return;
    }

    await fetchParticipants();
    setShowPaymentEditSheet(false);
  }

  async function saveItem(itemId: string, name: string, price: number) {
    const { error } = await supabase
      .from("items")
      .update({ name, price })
      .eq("id", itemId);

    if (error) {
      toast.error("Couldn't update item. Please try again.");
    }
  }

  async function deleteItem(itemId: string) {
    const { error } = await supabase
      .from("items")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Couldn't delete item. Please try again.");
    }
  }

  /* ================= PAYMENT PROGRESS ================= */

  const totalDebtors = settlements.length;

  const paidCount = settlements.filter(s =>
    paidIds.includes(s.fromId)
  ).length;

  const sessionStage =
    items.length === 0
      ? "Adding items"
      : !splitProgress.allClaimed
      ? "Claiming items"
      : paidCount !== totalDebtors
      ? "Settling payments"
      : "Complete";

  const focusSection =
    sessionStage === "Adding items"
      ? "input"
      : sessionStage === "Claiming items"
      ? "items"
      : sessionStage === "Settling payments"
      ? "payment"
      : "complete";

  const viewerSettlement = settlements.find(
    s => s.fromId === participantId
  );

  const viewerOwesMoney = !!viewerSettlement;

  const viewerIsDone =
    !viewerOwesMoney ||
    paidIds.includes(participantId ?? "");

  const allPaid =
    totalDebtors > 0 && paidCount === totalDebtors;

  useEffect(() => {
    if (!allPaid) return;
    if (status !== "active") return;

    setShowCompletion(true);

    supabase
      .from("sessions")
      .update({ status: "completed" })
      .eq("id", sessionId)
      .then(({ error }) => {
        if (!error) setStatus("completed");
      });
  }, [allPaid, status, sessionId]);

  const viewerBreakdown = useMemo(() => {
    if (!participantId) return null;

    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.price ?? 0),
      0
    );

    let foodTotal = 0;

    items.forEach(item => {
      const claimers = claims.filter(c => c.item_id === item.id);
      if (!claimers.length) return;

      const myClaim = claimers.find(
        c => c.participant_id === participantId
      );
      if (myClaim) {
        foodTotal += myClaim.amount ?? 0;
      }
    });

    const extra = taxAmount + tipAmount;

    let taxShare = 0;
    let tipShare = 0;

    if (subtotal > 0 && extra > 0) {
      const ratio = foodTotal / subtotal;

      taxShare = ratio * taxAmount;
      tipShare = ratio * tipAmount;
    }

    const total = foodTotal + taxShare + tipShare;

    return {
      foodTotal,
      taxShare,
      tipShare,
      total,
    };
  }, [participantId, items, claims, taxAmount, tipAmount]);

  const personalCard = (() => {
    if (!participantId) return null;

    // viewer owes money
    if (viewerOwesMoney && !viewerIsDone) {
      return (
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-md p-5 space-y-4">
          <p className="text-sm font-medium text-slate-600">
            You owe {viewerSettlement!.to}
          </p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            ${viewerSettlement!.amount.toFixed(2)}
          </p>
          {host?.venmo_username?.trim() ? (
            <a
              href={createVenmoLink(viewerSettlement!.amount, host.venmo_username)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center min-h-[48px] flex items-center justify-center rounded-xl bg-teal-500 text-white font-semibold hover:bg-teal-600 active:scale-[0.98] transition-all"
            >
              Pay now with Venmo
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="block w-full text-center min-h-[48px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 font-medium cursor-not-allowed"
            >
              Host hasn&apos;t added Venmo yet
            </button>
          )}
        </div>
      );
    }

    return null;
  })();

  const scrollToAddItem = () => {
    itemInputRef.current?.scrollIntoView({ behavior: "smooth" });
    itemInputRef.current?.focus();
  };

  const stickyActionBar = (() => {
    const w = "w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto";

    // ── Completed ──
    if (status === "completed") {
      return (
        <div className={`flex items-center justify-between gap-3 ${w}`}>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs flex-shrink-0">✓</span>
            All done!
          </div>
          <button
            type="button"
            onClick={() => setShowCompletion(true)}
            className="min-h-[44px] px-5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            View summary
          </button>
        </div>
      );
    }

    // ── Reviewing ──
    if (status === "reviewing") {
      if (isHost) {
        return (
          <div className={`flex items-center justify-center min-h-[48px] rounded-xl bg-slate-100 text-slate-500 font-medium text-sm ${w}`}>
            Reviewing split…
          </div>
        );
      }
      if (viewerSettlement) {
        return (
          <div className={`flex gap-2 ${w}`}>
            <div className="flex-1 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-medium text-sm px-3 min-h-[48px]">
              You owe <span className="font-bold ml-1">${viewerSettlement.amount.toFixed(2)}</span>
            </div>
            {host?.venmo_username?.trim() ? (
              <a
                href={createVenmoLink(viewerSettlement.amount, host.venmo_username)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-5 flex items-center justify-center rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all"
              >
                Pay now
              </a>
            ) : null}
          </div>
        );
      }
      return (
        <div className={`flex items-center justify-center min-h-[48px] rounded-xl bg-slate-100 text-slate-500 font-medium text-sm ${w}`}>
          Waiting for host to confirm…
        </div>
      );
    }

    // ── Active + host ──
    if (isHost) {
      // All items claimed → "Start review"
      if (splitProgress.allClaimed && items.length > 0) {
        return (
          <button
            type="button"
            onClick={startReview}
            className={`min-h-[56px] rounded-2xl bg-[var(--accent)] text-white font-semibold text-base hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(13,148,136,0.3)] ${w}`}
          >
            Start review →
          </button>
        );
      }
      // Items still unclaimed
      return (
        <div className={`flex gap-2 ${w}`}>
          <button
            type="button"
            onClick={scrollToAddItem}
            className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 text-sm hover:bg-slate-50 active:scale-[0.98] transition-all shrink-0"
          >
            + Item
          </button>
          <button
            type="button"
            onClick={() => setShowShareSheet(true)}
            className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 text-sm hover:bg-slate-50 active:scale-[0.98] transition-all shrink-0"
          >
            Share
          </button>
          <div className="flex-1 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 font-medium text-sm min-h-[48px] px-3 text-center">
            {items.length === 0
              ? "Add items to start"
              : `${splitProgress.unclaimedCount} item${splitProgress.unclaimedCount !== 1 ? "s" : ""} unclaimed`}
          </div>
        </div>
      );
    }

    // ── Active + participant owes (settling) ──
    if (sessionStage === "Settling payments" && viewerOwesMoney) {
      return (
        <div className={`flex gap-2 ${w}`}>
          <div className="flex items-center rounded-xl bg-slate-100 px-4 min-h-[48px] text-sm text-slate-700 shrink-0 font-medium">
            You owe <span className="font-bold ml-1">${viewerSettlement!.amount.toFixed(2)}</span>
          </div>
          {host?.venmo_username?.trim() ? (
            <a
              href={createVenmoLink(viewerSettlement!.amount, host.venmo_username)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[48px] flex items-center justify-center rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all"
            >
              Pay with Venmo
            </a>
          ) : (
            <span className="flex-1 min-h-[48px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 text-sm">
              Host hasn&apos;t added Venmo yet
            </span>
          )}
        </div>
      );
    }

    // ── Active + participant: show running total ──
    return (
      <div className={`flex gap-2 ${w}`}>
        <button
          type="button"
          onClick={scrollToAddItem}
          className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 text-sm hover:bg-slate-50 active:scale-[0.98] transition-all shrink-0"
        >
          + Item
        </button>
        <div className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 min-h-[48px] text-sm text-slate-600 font-medium px-3">
          Your total:
          <span className="font-bold text-slate-900">
            ${(viewerBreakdown?.total ?? 0).toFixed(2)}
          </span>
        </div>
      </div>
    );
  })();

  /* ================= UI ================= */

  return (
    <SessionShell
      header={
        <div className="max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto px-5 pt-4 pb-5 space-y-4">
          {/* Title row */}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {editingTitle ? (
                <input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onBlur={updateSessionTitle}
                  onKeyDown={e => { if (e.key === "Enter") updateSessionTitle(); }}
                  autoFocus
                  className="text-2xl sm:text-3xl font-bold w-full outline-none bg-transparent text-slate-900"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => isHost && setEditingTitle(true)}
                  className={`text-left w-full rounded-lg px-2 -mx-2 py-1.5 border border-transparent hover:border-slate-200 focus:border-teal-400 focus:outline-none transition-colors ${
                    isHost ? "cursor-pointer active:opacity-80" : "cursor-default"
                  }`}
                >
                  <span className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl sm:text-2xl font-bold text-slate-900 truncate max-w-[200px] sm:max-w-none block">
                      {sessionTitle}
                    </span>
                    {isHost && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-normal text-slate-500 shrink-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Tap to rename
                      </span>
                    )}
                  </span>
                </button>
              )}
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

          {/* Unified session card: avatars left, circular progress right */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] px-4 py-3 flex items-center gap-4">
            {/* Left: participant avatars */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                {participants.length} {participants.length === 1 ? "person" : "people"} · {onlineIds.length} online
              </p>
              <div className="flex items-end gap-3 overflow-x-auto pb-0.5 scrollbar-hide">
                {participants.map((p) => {
                  const isOnline = onlineIds.includes(p.id);
                  const isPaid = paidIds.includes(p.id);
                  const isParticipantHost = p.id === hostParticipantId;
                  return (
                    <div key={p.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className="relative">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm border-2 border-white shadow-sm"
                          style={{ backgroundColor: getParticipantColor(p.name) }}
                        >
                          {getInitials(p.name)}
                        </div>
                        {isOnline && !isPaid && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-white" />
                        )}
                        {isPaid && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[8px] font-bold">✓</span>
                        )}
                        {isParticipantHost && (
                          <span className="absolute -top-1.5 -right-1 text-[10px] leading-none">👑</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium max-w-[40px] truncate text-center leading-tight">
                        {p.name.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
                {isHost && (
                  <button
                    type="button"
                    onClick={openPaymentEditSheet}
                    className="flex-shrink-0 flex flex-col items-center gap-1"
                    title="Edit payment info"
                  >
                    <div className="w-9 h-9 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-500 hover:border-teal-400 hover:text-teal-500 transition-colors">
                      <span className="text-base leading-none font-semibold">$</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Venmo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right: circular progress ring */}
            <div className="flex-shrink-0">
              <CircularProgress
                percent={splitProgress.percent}
                allClaimed={splitProgress.allClaimed}
                totalItems={splitProgress.totalItems}
                claimedItems={splitProgress.claimedCount}
              />
            </div>
          </div>
        </div>
      }
      footer={stickyActionBar}
    >
      {/* Two-column on desktop: main flow left, summary rail right. Single column on mobile. */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start pb-12">
        {/* LEFT: main flow — variable width, not a rigid stack */}
        <div className="space-y-7 max-w-2xl lg:max-w-none">
          {/* You owe / Pay now — mobile only, above add item so flow is seamless */}
          {personalCard && (
            <div className="lg:hidden min-w-0">
              {personalCard}
            </div>
          )}

          {/* Add item — full width */}
          <div
            className={`space-y-2 transition-all ${
              focusSection === "input" ? "scale-[1.01]" : "opacity-90"
            }`}
          >
            <div className="flex gap-2">
              <input
                ref={itemInputRef}
                placeholder="Item name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    priceInputRef.current?.focus();
                  }
                }}
                className="flex-1 min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white/90 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
              />
              <input
                ref={priceInputRef}
                placeholder="$"
                value={price}
                onChange={e => setPrice(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") addItem();
                }}
                className="w-20 min-h-[48px] px-3 rounded-xl border border-slate-200 bg-white/90 text-center placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
              />
              <button
                type="button"
                onClick={addItem}
                className="min-h-[48px] px-4 rounded-xl bg-slate-900 text-white font-medium active:scale-[0.98] transition-transform hover:bg-slate-800"
              >
                Add
              </button>
              {status !== "completed" && (
                <button
                  type="button"
                  onClick={() => setShowScanModal(true)}
                  className="min-h-[48px] px-3 sm:px-4 rounded-xl border border-slate-200 bg-white/90 font-medium text-slate-600 active:scale-[0.98] transition-transform hover:bg-slate-50 shrink-0 flex items-center gap-1.5"
                  title="Scan receipt"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <span className="hidden sm:inline">Scan receipt</span>
                </button>
              )}
            </div>
            {/* Category chips */}
            <div className="flex gap-1.5 flex-wrap">
              {(splitType === "restaurant" ? RESTAURANT_CATS : GENERAL_CATS).map((cat) => {
                const active = selectedCategory === cat.id;
                const style = CAT_COLOR[cat.id] ?? CAT_COLOR.other;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(active ? null : cat.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 min-h-[28px]"
                    style={{
                      backgroundColor: active ? style.color : style.bg,
                      color: active ? "#fff" : style.color,
                      border: `1px solid ${style.color}55`,
                    }}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Invite banner — only when host is alone and session is active */}
          {isHost && participants.length === 1 && status === "active" && (
            <div className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-teal-900 text-sm">Add your items first, then invite your group</p>
                <p className="text-xs text-teal-700 mt-0.5">Friends can join, see items, and claim what they ordered</p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareSheet(true)}
                className="shrink-0 min-h-[44px] px-5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 active:scale-[0.98] transition-all"
              >
                Share & Invite
              </button>
            </div>
          )}

          {/* Items — main list */}
          <section className="lg:mr-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Items</h2>
            <ItemList
              items={items}
              claims={claims}
              participants={participants}
              participantId={participantId}
              claimingItemIds={claimingItemIds}
              focusSection={focusSection}
              toggleClaim={toggleClaim}
              claimRemaining={claimRemaining}
              getRemainingAmount={getRemainingAmount}
              setEditingClaim={setEditingClaim}
              setAmountInput={setAmountInput}
              lastClaimedItem={lastClaimedItem}
              isHost={isHost}
              isActive={status === "active"}
              onSaveItem={saveItem}
              onDeleteItem={deleteItem}
            />
          </section>
        </div>

        {/* RIGHT: sticky summary rail — only on desktop */}
        <div className="hidden lg:block lg:sticky lg:top-4 space-y-7">
          {/* You owe / Pay now — desktop: in rail so main column stays add item → items */}
          {personalCard && (
            <section className="min-w-0">
              {personalCard}
            </section>
          )}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Bill</h2>
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] p-4 space-y-4">
              <BillSummaryCard
                subtotal={billSummary.subtotal}
                claimedTotal={billSummary.claimedTotal}
                remaining={billSummary.remaining}
                taxAmount={taxAmount}
                tipAmount={tipAmount}
                total={billSummary.total}
                showTip={splitType === "restaurant"}
                inline
              />
              <TaxTipInputs
                taxInput={taxInput}
                tipInput={tipInput}
                setTaxInput={setTaxInput}
                setTipInput={setTipInput}
                showTip={splitType === "restaurant"}
                inline
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Live totals</h2>
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] divide-y divide-slate-50 overflow-hidden">
              {participants.map(p => {
                const amount = totals[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex justify-between items-center px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: getParticipantColor(p.name) }}
                      >
                        {getInitials(p.name)}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums transition-all duration-300 ${amount > 0.005 ? "text-[var(--accent)]" : "text-slate-500"}`}>
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SettlementPanel
              settlements={settlements}
              paidIds={paidIds}
              paidCount={paidCount}
              totalDebtors={totalDebtors}
              isHost={isHost}
              status={status}
              participantId={participantId}
              sessionId={sessionId}
              markPaid={markPaid}
              createVenmoLink={createVenmoLink}
              hostVenmoUsername={host?.venmo_username}
              hostCashAppUsername={host?.cashapp_username}
              isCurrentUserHost={isHost}
              onOpenPaymentEdit={openPaymentEditSheet}
              copyPaymentRequest={copyPaymentRequest}
              copyAllPaymentRequests={copyAllPaymentRequests}
              startReview={startReview}
            />
          </section>
        </div>

        {/* Mobile: bill, live totals, settlement below items (same order, full width) */}
        <div className="lg:hidden space-y-7 mt-7">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Bill</h2>
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] p-4 space-y-4">
              <BillSummaryCard
                subtotal={billSummary.subtotal}
                claimedTotal={billSummary.claimedTotal}
                remaining={billSummary.remaining}
                taxAmount={taxAmount}
                tipAmount={tipAmount}
                total={billSummary.total}
                showTip={splitType === "restaurant"}
                inline
              />
              <TaxTipInputs
                taxInput={taxInput}
                tipInput={tipInput}
                setTaxInput={setTaxInput}
                setTipInput={setTipInput}
                showTip={splitType === "restaurant"}
                inline
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Live totals</h2>
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)] divide-y divide-slate-50 overflow-hidden">
              {participants.map(p => {
                const amount = totals[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex justify-between items-center px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: getParticipantColor(p.name) }}
                      >
                        {getInitials(p.name)}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums transition-all duration-300 ${amount > 0.005 ? "text-[var(--accent)]" : "text-slate-500"}`}>
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <SettlementPanel
              settlements={settlements}
              paidIds={paidIds}
              paidCount={paidCount}
              totalDebtors={totalDebtors}
              isHost={isHost}
              status={status}
              participantId={participantId}
              sessionId={sessionId}
              markPaid={markPaid}
              createVenmoLink={createVenmoLink}
              hostVenmoUsername={host?.venmo_username}
              hostCashAppUsername={host?.cashapp_username}
              isCurrentUserHost={isHost}
              onOpenPaymentEdit={openPaymentEditSheet}
              copyPaymentRequest={copyPaymentRequest}
              copyAllPaymentRequests={copyAllPaymentRequests}
              startReview={startReview}
            />
          </section>
        </div>
      </div>

      {/* Review Modal */}
      {status === "reviewing" && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 text-center shadow-xl border border-white/80"
          >
            <h2 className="text-2xl font-semibold text-slate-900">
              Review split
            </h2>

            <p className="text-slate-600">
              Double check everything before finalizing.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2 text-left">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${billSummary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
              {splitType === "restaurant" && (
                <div className="flex justify-between">
                  <span>Tip</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>${billSummary.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={confirmSplit}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium active:scale-[0.98] hover:bg-slate-800"
              >
                Confirm split
              </button>
              <button
                type="button"
                onClick={reopenSplit}
                className="w-full text-slate-500 py-2"
              >
                Edit split
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Completion Overlay UI */}
      {showCompletion && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl p-6 w-full max-w-[400px] space-y-6 text-center shadow-xl border border-white/80"
          >
            <h2 className="text-2xl font-semibold text-slate-900">
              You're all set
            </h2>
            <p className="text-sm text-slate-500">
              Split complete. Here's your summary.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${billSummary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
              {splitType === "restaurant" && (
                <div className="flex justify-between">
                  <span>Tip</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>${billSummary.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-left">
              <h3 className="text-sm font-semibold text-slate-700">
                Your total
              </h3>

              {viewerBreakdown && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>{splitType === "restaurant" ? "Food" : "Items"}</span>
                    <span>${viewerBreakdown.foodTotal.toFixed(2)}</span>
                  </div>

                  {taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>${viewerBreakdown.taxShare.toFixed(2)}</span>
                    </div>
                  )}

                  {splitType === "restaurant" && tipAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tip</span>
                      <span>${viewerBreakdown.tipShare.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total You Paid</span>
                    <span>${viewerBreakdown.total.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void exportPDF()}
                className="w-full border border-[var(--accent)] text-[var(--accent)] py-3.5 rounded-xl font-semibold min-h-[48px] active:scale-[0.98] transition-transform hover:bg-teal-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => setShowCompletion(false)}
                className="w-full border border-slate-200 bg-white text-slate-700 py-3.5 rounded-xl font-medium min-h-[48px] active:scale-[0.98] transition-transform hover:bg-slate-50"
              >
                Back to split
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-medium min-h-[48px] active:scale-[0.98] transition-transform hover:bg-slate-800"
              >
                {isHost ? "Start new split" : "Done"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <ScanReceiptModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onAddItems={addItemsFromScan}
        onExtractItems={extractItemsFromFile}
      />

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
                  {otherClaims.length > 0 && (
                    <> · <span className="font-medium">${maxAllowed.toFixed(2)} available</span></>
                  )}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-medium text-slate-400">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max={maxAllowed}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitAmount(editingClaim); }}
                  autoFocus
                  placeholder="0.00"
                  className="w-32 text-3xl font-bold text-center text-slate-900 border-b-2 border-[var(--accent)] bg-transparent outline-none py-1"
                />
              </div>
              <button
                type="button"
                onClick={() => commitAmount(editingClaim)}
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
      {showPaymentEditSheet && isHost && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-center">Payment info</h3>
            <p className="text-sm text-slate-500 text-center">
              So others can pay you directly
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Venmo username
                </label>
                <input
                  value={editVenmoInput}
                  onChange={e => setEditVenmoInput(e.target.value)}
                  placeholder="@username"
                  className="mt-1 w-full min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  CashApp username
                </label>
                <input
                  value={editCashAppInput}
                  onChange={e => setEditCashAppInput(e.target.value)}
                  placeholder="$username"
                  className="mt-1 w-full min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={savePaymentInfo}
              className="w-full min-h-[48px] bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 active:scale-[0.98] transition-all"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowPaymentEditSheet(false)}
              className="w-full text-slate-500 py-2"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}

      {joinCode && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          sessionId={sessionId}
          joinCode={joinCode}
        />
      )}
    </SessionShell>
  );
}