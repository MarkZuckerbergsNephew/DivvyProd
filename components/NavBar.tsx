"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getParticipantColor, getInitials } from "@/lib/participantColor";
import type { User } from "@supabase/supabase-js";

export default function NavBar() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) loadDisplayName(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadDisplayName(u.id);
      else setDisplayName(null);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDisplayName(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    setDisplayName(data?.display_name ?? null);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  async function handleSignOut() {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const avatarName = displayName ?? user?.email?.split("@")[0] ?? "";
  const avatarColor = avatarName ? getParticipantColor(avatarName) : "#94a3b8";
  const avatarInitials = avatarName ? getInitials(avatarName) : "?";

  return (
    <nav className="w-full border-b border-[var(--border)] bg-white/90 backdrop-blur-xl supports-[padding:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)] relative z-30">
      <div className="max-w-[480px] md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-3 flex justify-between items-center min-h-[48px]">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="font-bold text-slate-900 text-lg -ml-1 py-2 px-1 min-h-[44px] flex items-center tracking-tight hover:text-teal-700 transition-colors"
        >
          Divvy
        </button>

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-2"
              style={{ backgroundColor: avatarColor }}
              aria-label="Account menu"
              aria-expanded={dropdownOpen}
            >
              {avatarInitials}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-elevated)] overflow-hidden z-[200]">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--text-muted)] truncate">
                    {displayName ?? user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); router.push("/dashboard"); }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-[var(--text)] hover:bg-slate-50 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); router.push("/profile"); }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-[var(--text)] hover:bg-slate-50 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Profile
                </button>
                <div className="border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-light)] transition-colors flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm font-medium text-slate-600 py-2 px-4 min-h-[44px] flex items-center rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
