"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useToast } from "@/hooks/useToast";

type View = "sign-in" | "forgot-password";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const supabase = createSupabaseBrowserClient();

  const [view, setView] = useState<View>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "auth_callback_failed") {
      setGeneralError("Sign-in link expired or invalid. Please try again.");
    }
  }, [searchParams]);

  function clearErrors() {
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);
  }

  async function handleGoogleSignIn() {
    clearErrors();
    setLoading(true);
    const next = searchParams.get("next") ?? "/";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setGeneralError("Couldn't connect to Google. Please try again.");
      setLoading(false);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      return;
    }
    if (!password) {
      setPasswordError("Please enter your password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      // Never clear email — only clear password on wrong credentials
      setPassword("");
      if (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("credentials")) {
        setPasswordError("Incorrect password. Please try again or reset your password below.");
      } else if (error.message.toLowerCase().includes("email")) {
        setEmailError("No account found with this email. Check for typos or sign up below.");
      } else if (error.message.toLowerCase().includes("confirmed")) {
        setEmailError("Please confirm your email before signing in. Check your inbox.");
      } else {
        setGeneralError("Sign-in failed: " + error.message);
      }
      return;
    }

    const next = searchParams.get("next") ?? "/";
    router.push(next);
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    if (!email.trim()) {
      setEmailError("Enter your email address to receive a reset link.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);

    if (error) {
      setGeneralError("Couldn't send reset email: " + error.message);
      return;
    }

    setResetSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-[420px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-elevated)] p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">
              {view === "sign-in" ? "Welcome back" : "Reset your password"}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {view === "sign-in"
                ? "Sign in to see your splits and running tabs."
                : "We'll email you a link to reset your password."}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {view === "sign-in" ? (
              <motion.div
                key="sign-in"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Google OAuth */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full min-h-[52px] flex items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-white text-[var(--text)] font-semibold text-base hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-xs text-[var(--text-hint)] font-medium">or continue with email</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>

                <form onSubmit={handleEmailSignIn} className="space-y-4" noValidate>
                  {generalError && (
                    <p className="text-sm text-[var(--error)] bg-[var(--error-light)] px-4 py-3 rounded-xl">
                      {generalError}
                    </p>
                  )}

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
                    {emailError && (
                      <p className="text-xs text-[var(--error)]">{emailError}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                        placeholder="Your password"
                        autoComplete="current-password"
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
                    {passwordError && (
                      <p className="text-xs text-[var(--error)]">{passwordError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setView("forgot-password"); clearErrors(); }}
                      className="text-xs text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[52px] bg-[var(--accent)] text-white rounded-xl font-semibold text-base hover:bg-[var(--accent-dark)] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(13,148,136,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </button>
                </form>

                <p className="text-center text-sm text-[var(--text-muted)]">
                  Don&apos;t have an account?{" "}
                  <a href="/signup" className="text-[var(--accent)] font-medium hover:text-[var(--accent-dark)] transition-colors">
                    Sign up
                  </a>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {resetSent ? (
                  <div className="text-center space-y-4 py-2">
                    <div className="w-14 h-14 rounded-full bg-[var(--success-light)] flex items-center justify-center mx-auto">
                      <svg className="w-7 h-7 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--text)]">Check your inbox</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        We sent a reset link to <strong>{email}</strong>. It expires in 1 hour.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setView("sign-in"); setResetSent(false); clearErrors(); }}
                      className="text-sm text-[var(--accent)] font-medium hover:text-[var(--accent-dark)] transition-colors"
                    >
                      ← Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                    {generalError && (
                      <p className="text-sm text-[var(--error)] bg-[var(--error-light)] px-4 py-3 rounded-xl">
                        {generalError}
                      </p>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Email address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                        className={`w-full min-h-[52px] px-4 rounded-xl border bg-slate-50/50 text-base placeholder:text-[var(--text-hint)] focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors ${emailError ? "border-[var(--error)]" : "border-[var(--border)]"}`}
                      />
                      {emailError && (
                        <p className="text-xs text-[var(--error)]">{emailError}</p>
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
                          Sending…
                        </>
                      ) : (
                        "Send reset link"
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setView("sign-in"); clearErrors(); }}
                      className="w-full text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors py-1"
                    >
                      ← Back to sign in
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </main>
  );
}
