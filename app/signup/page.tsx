"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useToast } from "@/hooks/useToast";

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-400" };
  if (score <= 2) return { score, label: "Fair", color: "bg-amber-400" };
  if (score <= 3) return { score, label: "Good", color: "bg-teal-400" };
  return { score, label: "Strong", color: "bg-teal-600" };
}

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createSupabaseBrowserClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const strength = getPasswordStrength(password);

  function clearErrors() {
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    setGeneralError(null);
  }

  async function handleGoogleSignUp() {
    clearErrors();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    if (error) {
      setGeneralError("Couldn't connect to Google. Please try again.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    let hasError = false;
    if (!displayName.trim()) {
      setNameError("Please enter your name.");
      hasError = true;
    }
    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      hasError = true;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      hasError = true;
    }
    if (password !== confirm) {
      setConfirmError("Passwords don't match. Please try again.");
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) {
      // Email never clears on any error
      if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already exists")) {
        setEmailError("An account with this email already exists. Try signing in instead.");
      } else if (error.message.toLowerCase().includes("email")) {
        setEmailError(error.message);
      } else {
        setGeneralError("Couldn't create account: " + error.message);
      }
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: displayName.trim(),
      });
    }

    // Attempt immediate sign-in so the user doesn't need to confirm email first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Email confirmation is required — session can't start yet
      toast.success("Account created! Check your email to confirm, then sign in.");
      router.push("/login");
      return;
    }

    toast.success("Account created! Welcome to Divvy.");
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-elevated)] p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">Create account</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Save your splits and set up running tabs.
            </p>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full min-h-[52px] flex items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white text-[var(--text)] font-semibold text-base hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--text-hint)] font-medium">or sign up with email</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {generalError && (
              <p className="text-sm text-[var(--error)] bg-[var(--error-light)] px-4 py-3 rounded-xl">
                {generalError}
              </p>
            )}

            {/* Display name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Your name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setNameError(null); }}
                placeholder="Alex Smith"
                autoComplete="name"
                autoFocus
                className={`w-full min-h-[52px] px-4 rounded-xl border bg-slate-50/50 text-base placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors ${nameError ? "border-[var(--error)]" : "border-[var(--border)]"}`}
              />
              {nameError && <p className="text-xs text-[var(--error)]">{nameError}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                placeholder="you@example.com"
                autoComplete="email"
                className={`w-full min-h-[52px] px-4 rounded-xl border bg-slate-50/50 text-base placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors ${emailError ? "border-[var(--error)]" : "border-[var(--border)]"}`}
              />
              {emailError && <p className="text-xs text-[var(--error)]">{emailError}</p>}
            </div>

            {/* Password + strength */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className={`w-full min-h-[52px] px-4 pr-12 rounded-xl border bg-slate-50/50 text-base placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors ${passwordError ? "border-[var(--error)]" : "border-[var(--border)]"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-all duration-200 ${
                          strength.score >= i ? strength.color : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strength.score <= 1 ? "text-red-500" : strength.score <= 2 ? "text-amber-500" : "text-teal-600"}`}>
                    {strength.label}
                  </p>
                </div>
              )}
              {passwordError && <p className="text-xs text-[var(--error)]">{passwordError}</p>}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setConfirmError(null); }}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className={`w-full min-h-[52px] px-4 rounded-xl border bg-slate-50/50 text-base placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors ${confirmError ? "border-[var(--error)]" : "border-[var(--border)]"}`}
              />
              {confirmError && <p className="text-xs text-[var(--error)]">{confirmError}</p>}
              {confirm && !confirmError && password === confirm && (
                <p className="text-xs text-[var(--success)] font-medium">Passwords match ✓</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[52px] bg-[var(--accent)] text-white rounded-xl font-semibold text-base hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(13,148,136,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)]">
            Already have an account?{" "}
            <a href="/login" className="text-[var(--accent)] font-medium hover:text-[var(--accent-dark)] transition-colors">
              Sign in
            </a>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
