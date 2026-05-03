"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { calculateTotals } from "@/lib/billMath";
import { generatePaymentLink } from "@/lib/paymentLink";
import { useSessionRealtime } from "@/hooks/useSessionRealtime";
import { motion } from "framer-motion";
import {
  SessionShell,
  BillSummaryCard,
  TaxTipInputs,
  SplitProgress,
  ParticipantList,
  ItemList,
  SettlementPanel,
  JoinCodeBanner,
  ScanReceiptModal,
} from "@/components/session";

/* ================= TYPES ================= */

type Item = {
  id: string;
  name: string;
  price: number | null;
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

/* ================= COMPONENT ================= */

export default function SessionClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ================= STATE ================= */
  
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<string[]>([]);

  const [hostParticipantId, setHostParticipantId] =
    useState<string | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [splitType, setSplitType] =
    useState<"restaurant" | "general" | null>(null);
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

  const [finishing, setFinishing] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

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
        "title, host_participant_id, split_type, status, tax_amount, tip_amount, join_code"
      )
      .eq("id", sessionId)
      .single();

    if (!data) return;

    setHostParticipantId(data.host_participant_id);
    if (data.title) setSessionTitle(data.title);
    setStatus((data as { status?: string }).status ?? "active");
    setSplitType((data as { split_type?: "restaurant" | "general" }).split_type ?? null);
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
      .select("id, name, venmo_username")
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
    const { data: claimers } = await supabase
      .from("claims")
      .select("id")
      .eq("item_id", itemId);

    if (!claimers || claimers.length === 0) return;

    const even = 100 / claimers.length;

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
          console.error(error);
          setClaims(prev => [...prev, existing]);
          alert("Something went wrong. Please try again.");
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
          console.error(error);
          setClaims(prev => prev.filter(c => c.id !== tempId));
          alert("Something went wrong. Please try again.");
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
    });

    if (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
      return;
    }
    fetchItems();
    setName("");
    setPrice("");
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
      console.error(error);
      alert("Something went wrong. Please try again.");
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
          console.error(error);
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
          console.error(error);
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
      alert("Enter a valid amount.");
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
      alert(
        `Only $${maxAllowed.toFixed(2)} remaining for this item.`
      );
      return;
    }

    const { error } = await supabase
      .from("claims")
      .update({ amount: entered })
      .eq("id", claim.id);

    if (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
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
      console.error("Payment failed:", error);
      alert("Something went wrong. Please try again.");
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

  function copyPaymentRequest(fromId: string, amount: number) {
    const link = generatePaymentLink(sessionId, fromId);
    const text = `You owe $${amount.toFixed(2)} for our split.\n\nPay here:\n${link}`;
    void navigator.clipboard.writeText(text);
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
      console.error("startReview failed:", error);
      setStatus("active");
      alert("Could not start review. Try again or refresh.");
    }
  }

  async function confirmSplit() {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);

    if (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
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
      console.error(error);
      alert("Something went wrong. Please try again.");
      return;
    }
    setStatus("active");
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
          <a
            href={createVenmoLink(viewerSettlement!.amount, host?.venmo_username)}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center min-h-[48px] flex items-center justify-center rounded-xl bg-teal-500 text-white font-semibold hover:bg-teal-600 active:scale-[0.98] transition-all"
          >
            Pay now
          </a>
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
    if (status === "completed") {
      return (
        <button
          type="button"
          onClick={() => setShowCompletion(true)}
          className="w-full min-h-[48px] bg-slate-900 text-white rounded-xl font-semibold active:scale-[0.98] transition-transform hover:bg-slate-800"
        >
          View summary
        </button>
      );
    }

    const addItemBtn = (
      <button
        key="add"
        type="button"
        onClick={scrollToAddItem}
        className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white/90 font-medium text-slate-800 active:scale-[0.98] transition-transform shrink-0"
      >
        + Item
      </button>
    );

    const inviteBtn = joinCode ? (
      <button
        key="invite"
        type="button"
        onClick={shareInvite}
        className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white/90 font-medium text-slate-600 active:scale-[0.98] transition-transform shrink-0"
      >
        Invite
      </button>
    ) : null;

    if (sessionStage === "Settling payments" && viewerOwesMoney) {
      return (
        <div className="flex gap-2 w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto">
          {addItemBtn}
          {inviteBtn}
          <a
            href={createVenmoLink(viewerSettlement!.amount, host?.venmo_username)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[48px] flex items-center justify-center rounded-xl bg-emerald-600 text-white font-medium active:scale-[0.98] transition-transform"
          >
            Pay ${viewerSettlement!.amount.toFixed(2)}
          </a>
        </div>
      );
    }

    if (sessionStage === "Complete" && isHost && status === "active") {
      return (
        <button
          type="button"
          onClick={startReview}
          className="w-full min-h-[48px] bg-slate-900 text-white rounded-xl font-medium active:scale-[0.98] transition-transform hover:bg-slate-800"
        >
          Review Split
        </button>
      );
    }

    return (
      <div className="flex gap-2 w-full max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto">
        {addItemBtn}
        {inviteBtn}
        {sessionStage === "Adding items" && (
          <button
            type="button"
            onClick={scrollToAddItem}
            className="flex-1 min-h-[48px] bg-slate-900 text-white rounded-xl font-medium active:scale-[0.98] transition-transform hover:bg-slate-800"
          >
            Add item
          </button>
        )}
        {sessionStage === "Claiming items" && (
          <button
            type="button"
            onClick={shareInvite}
            className="flex-1 min-h-[48px] bg-slate-900 text-white rounded-xl font-medium active:scale-[0.98] transition-transform hover:bg-slate-800"
          >
            Invite friends
          </button>
        )}
      </div>
    );
  })();

  /* ================= UI ================= */

  return (
    <SessionShell
      header={
        <div className="max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto px-4 pt-3 pb-4">
          <div className="flex flex-col md:flex-row md:items-end md:gap-4 lg:gap-6 gap-4">
            {/* Left: title + participants + split progress; cap width so split progress and join code don't overlap */}
            <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-end gap-4 lg:gap-6 md:max-w-[65%] lg:max-w-[70%]">
              <div className="min-w-0 space-y-3 flex-none">
                <div>
                  {editingTitle ? (
                    <input
                      value={titleInput}
                      onChange={e => setTitleInput(e.target.value)}
                      onBlur={updateSessionTitle}
                      onKeyDown={e => {
                        if (e.key === "Enter") updateSessionTitle();
                      }}
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
                      <span className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                        {sessionTitle}
                        {isHost && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-normal text-slate-400">
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
                <div className="min-w-0 w-fit min-w-[200px] max-w-[420px]">
                  <ParticipantList
                    participants={participants}
                    onlineIds={onlineIds}
                    paidIds={paidIds}
                    hostParticipantId={hostParticipantId}
                    getAvatarColor={getAvatarColor}
                  />
                </div>
              </div>
              <div className="min-w-0 sm:min-w-[220px] flex-1">
                <SplitProgress
                  percent={splitProgress.percent}
                  unclaimedCount={splitProgress.unclaimedCount}
                  allClaimed={splitProgress.allClaimed}
                  sessionStage={sessionStage}
                />
              </div>
            </div>

            {/* Right: join code stays in original position (pushed right) */}
            {joinCode && (
              <div className="flex-shrink-0 md:ml-auto">
                <JoinCodeBanner
                  code={joinCode}
                  participantCount={participants.length}
                  sessionId={sessionId}
                />
              </div>
            )}
          </div>
        </div>
      }
      footer={stickyActionBar}
    >
      {/* Two-column on desktop: main flow left, summary rail right. Single column on mobile. */}
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start pb-12">
        {/* LEFT: main flow — variable width, not a rigid stack */}
        <div className="space-y-6 max-w-2xl lg:max-w-none">
          {/* You owe / Pay now — mobile only, above add item so flow is seamless */}
          {personalCard && (
            <div className="lg:hidden min-w-0">
              {personalCard}
            </div>
          )}

          {/* Add item — full width */}
          <div
            className={`flex gap-2 transition-all ${
              focusSection === "input" ? "scale-[1.01]" : "opacity-90"
            }`}
          >
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
                className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white/90 font-medium text-slate-600 active:scale-[0.98] transition-transform hover:bg-slate-50 shrink-0"
              >
                Scan receipt
              </button>
            )}
          </div>

          {/* Items — main list */}
          <section className="lg:mr-0">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Items</h2>
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
            />
          </section>
        </div>

        {/* RIGHT: sticky summary rail — only on desktop */}
        <div className="hidden lg:block lg:sticky lg:top-4 space-y-6">
          {/* You owe / Pay now — desktop: in rail so main column stays add item → items */}
          {personalCard && (
            <section className="min-w-0">
              {personalCard}
            </section>
          )}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Bill</h2>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-md p-4 space-y-4">
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
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Live totals</h2>
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-md divide-y divide-slate-100 overflow-hidden">
              {participants.map(p => (
                <div
                  key={p.id}
                  className="flex justify-between items-center px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full text-white text-xs flex items-center justify-center ${getAvatarColor(
                        p.id
                      )}`}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{p.name}</span>
                  </div>
                  <span className="font-semibold transition-all duration-300">
                    ${totals[p.id].toFixed(2)}
                  </span>
                </div>
              ))}
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
              copyPaymentRequest={copyPaymentRequest}
              copyAllPaymentRequests={copyAllPaymentRequests}
              startReview={startReview}
            />
          </section>
        </div>

        {/* Mobile: bill, live totals, settlement below items (same order, full width) */}
        <div className="lg:hidden space-y-6 mt-6">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Bill</h2>
            <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl shadow-md p-4 space-y-4">
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
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Live totals</h2>
            <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl shadow-md divide-y divide-slate-100 overflow-hidden">
              {participants.map(p => (
                <div
                  key={p.id}
                  className="flex justify-between items-center px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full text-white text-xs flex items-center justify-center ${getAvatarColor(
                        p.id
                      )}`}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{p.name}</span>
                  </div>
                  <span className="font-semibold transition-all duration-300">
                    ${totals[p.id].toFixed(2)}
                  </span>
                </div>
              ))}
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

      {editingClaim && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-center">
              Enter Amount
            </h3>

            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              placeholder="0.00"
              className="w-full border rounded-lg p-3 text-center text-lg"
            />

            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map(v => (
                <button
                  key={v}
                  onClick={() => setAmountInput(String(v))}
                  className="border rounded-lg py-2"
                >
                  ${v}
                </button>
              ))}
            </div>

            <button
              onClick={() => commitAmount(editingClaim)}
              className="w-full bg-black text-white py-3 rounded-xl"
            >
              Save
            </button>

            <button
              onClick={() => {
                setEditingClaim(null);
                setAmountInput("");
              }}
              className="w-full text-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SessionShell>
  );
}