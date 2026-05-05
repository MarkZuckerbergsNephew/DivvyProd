"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useToast } from "@/hooks/useToast";
import { getParticipantColor, getInitials } from "@/lib/participantColor";

interface Profile {
  display_name: string | null;
  venmo_username: string | null;
  cashapp_username: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [venmo, setVenmo] = useState("");
  const [cashApp, setCashApp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, venmo_username, cashapp_username")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setVenmo(profile.venmo_username ?? "");
        setCashApp(profile.cashapp_username ?? "");
      } else {
        // Fallback: use metadata from auth
        setDisplayName(user.user_metadata?.display_name ?? "");
      }
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Display name can't be empty.");
      return;
    }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: displayName.trim(),
        venmo_username: venmo.trim() || null,
        cashapp_username: cashApp.trim() || null,
      });

    setSaving(false);

    if (error) {
      toast.error("Couldn't save changes: " + error.message);
      return;
    }
    toast.success("Profile updated!");
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const avatarColor = getParticipantColor(displayName || email);
  const avatarInitials = getInitials(displayName || email.split("@")[0]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-elevated)] p-6 sm:p-8 space-y-6">
          {/* Avatar + title */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarInitials}
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">Your profile</h1>
              <p className="text-sm text-[var(--text-muted)]">{email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full min-h-[52px] px-4 rounded-xl border border-[var(--border)] bg-slate-50/50 text-base placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full min-h-[52px] px-4 rounded-xl border border-[var(--border)] bg-slate-100 text-base text-[var(--text-muted)] cursor-not-allowed"
              />
              <p className="text-xs text-[var(--text-hint)]">Email cannot be changed here.</p>
            </div>

            <div className="pt-1 border-t border-[var(--border)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Payment info
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Venmo username</label>
                  <input
                    type="text"
                    value={venmo}
                    onChange={(e) => setVenmo(e.target.value)}
                    placeholder="@username"
                    className="w-full min-h-[48px] px-4 rounded-xl border border-[var(--border)] bg-slate-50/50 text-sm placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">CashApp username</label>
                  <input
                    type="text"
                    value={cashApp}
                    onChange={(e) => setCashApp(e.target.value)}
                    placeholder="$username"
                    className="w-full min-h-[48px] px-4 rounded-xl border border-[var(--border)] bg-slate-50/50 text-sm placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
                  />
                </div>
                <p className="text-xs text-[var(--text-hint)]">
                  These auto-fill when you join a split, saving you time.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[52px] bg-[var(--accent)] text-white rounded-xl font-semibold text-base hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(13,148,136,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full min-h-[44px] text-sm font-medium text-[var(--error)] hover:bg-[var(--error-light)] rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {signingOut ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-red-300 border-t-red-500 animate-spin" />
                  Signing out…
                </>
              ) : (
                "Sign out"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
