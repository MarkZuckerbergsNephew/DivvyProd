"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Props = {
  code: string;
  participantCount?: number;
  /** Session id to build join URL for Share (e.g. origin/join/sessionId). */
  sessionId?: string;
};

export default function JoinCodeBanner({ code, participantCount = 0, sessionId }: Props) {
  const [copied, setCopied] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("input");
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function shareOrCopyLink() {
    if (!sessionId) return;
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${sessionId}` : "";
    if (!shareUrl) return;
    setShareDone(false);

    // On mobile (and some desktop), use native share sheet so user can pick iMessage, Instagram, etc.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join our Divvy split",
          text: `Join our split on Divvy! Code: ${code}`,
          url: shareUrl,
        });
        setShareDone(true);
        setTimeout(() => setShareDone(false), 2000);
        return;
      } catch (err) {
        // User cancelled or share failed — fall back to copy link
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Desktop or fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareDone(true);
      setTimeout(() => setShareDone(false), 2000);
    } catch {
      const el = document.createElement("input");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setShareDone(true);
      setTimeout(() => setShareDone(false), 2000);
    }
  }

  return (
    <motion.div
      layout
      className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 to-slate-50 p-5 shadow-md"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700/90 mb-1">
        Join code
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
        <div className="rounded-xl bg-white/90 border border-teal-100 px-4 py-3 text-2xl sm:text-3xl font-mono font-bold tracking-[0.25em] min-h-[48px] flex items-center justify-center text-slate-800 sm:min-w-[140px]">
          {code}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={copyCode}
            className="min-h-[44px] px-4 rounded-xl bg-teal-500 text-white font-semibold text-sm active:scale-95 transition-transform hover:bg-teal-600 flex items-center justify-center"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
          {sessionId && (
            <button
              type="button"
              onClick={shareOrCopyLink}
              className="min-h-[44px] px-4 rounded-xl border border-teal-300 bg-white text-teal-700 font-semibold text-sm active:scale-95 transition-transform hover:bg-teal-50 flex items-center justify-center"
            >
              {shareDone ? "✓ Done" : "Share"}
            </button>
          )}
        </div>
      </div>
      {participantCount > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {participantCount} {participantCount === 1 ? "person" : "people"} joined
        </p>
      )}
    </motion.div>
  );
}
