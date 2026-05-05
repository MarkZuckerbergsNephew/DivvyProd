"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  joinCode: string | null;
  /** Optional CTA rendered between the share buttons and Done (e.g. "Join as host →") */
  actionCta?: React.ReactNode;
};

export default function ShareSheet({ isOpen, onClose, sessionId, joinCode, actionCta }: Props) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://divvy.vercel.app/join/${sessionId}`;
    return `${window.location.origin}/join/${sessionId}`;
  }, [sessionId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {
      const el = document.createElement("input");
      el.value = joinUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareNative() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join my Divvy split",
          text: joinCode
            ? `Join our split on Divvy! Code: ${joinCode}`
            : "Join our split on Divvy!",
          url: joinUrl,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    // Fallback: copy
    copyLink();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex justify-center"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="w-full max-w-md bg-white rounded-t-2xl px-6 pt-4 pb-8 space-y-5">
              {/* Drag handle */}
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

              <h2 className="text-lg font-semibold text-slate-900 text-center">Invite people</h2>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm inline-block">
                  <QRCodeSVG
                    value={joinUrl}
                    size={200}
                    level="M"
                    marginSize={0}
                  />
                </div>
              </div>

              {/* Join code */}
              {joinCode && (
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Join code
                  </p>
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] text-slate-900">
                    {joinCode}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-1 min-h-[48px] rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
                >
                  {copied ? "✓ Copied!" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={shareNative}
                  className="flex-1 min-h-[48px] rounded-xl bg-teal-500 text-white font-semibold text-sm hover:bg-teal-600 active:scale-[0.98] transition-all"
                >
                  {shared ? "✓ Shared!" : "Share"}
                </button>
              </div>

              {actionCta}

              <button
                type="button"
                onClick={onClose}
                className="w-full text-slate-500 text-sm py-1"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
