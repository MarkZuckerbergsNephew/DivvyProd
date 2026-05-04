"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

const STYLES: Record<ToastType, string> = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  error: "bg-red-50 border-red-200 text-red-900",
  info: "bg-white border-slate-200 text-slate-900",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "bg-emerald-500 text-white",
  error: "bg-red-500 text-white",
  info: "bg-slate-200 text-slate-700",
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => {
      const next = [...prev, { id, type, message }];
      // drop oldest if over limit
      if (next.length > MAX_TOASTS) {
        const dropped = next.shift()!;
        const dt = timers.current.get(dropped.id);
        if (dt) clearTimeout(dt);
        timers.current.delete(dropped.id);
      }
      return [...next];
    });
    const ms = type === "error" ? 5000 : 3000;
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  const ctx: ToastContextValue = {
    success: (msg) => addToast("success", msg),
    error: (msg) => addToast("error", msg),
    info: (msg) => addToast("info", msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* top-center on mobile, top-right on desktop */}
      <div
        aria-live="polite"
        className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto flex flex-col items-center sm:items-end gap-2 z-[200] pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.94 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium w-full sm:w-auto sm:max-w-[360px] ${STYLES[t.type]}`}
            >
              <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${ICON_STYLES[t.type]}`}>
                {ICONS[t.type]}
              </span>
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 opacity-50 hover:opacity-80 transition-opacity ml-1 text-lg leading-none"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
