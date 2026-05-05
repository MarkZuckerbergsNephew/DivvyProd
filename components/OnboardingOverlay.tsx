"use client";

import { useEffect, useState } from "react";

export type OnboardingStep = {
  icon: string;
  title: string;
  description: string;
};

type Props = {
  steps: OnboardingStep[];
  storageKey: string;
  ready: boolean;
};

export default function OnboardingOverlay({ steps, storageKey, ready }: Props) {
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    if (localStorage.getItem(storageKey) !== null) return;
    const t = setTimeout(() => {
      setVisible(true);
      // Two rAFs so the initial translateY(100%) renders before we animate to 0
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    }, 500);
    return () => clearTimeout(t);
  }, [ready, storageKey]);

  function dismiss() {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, "true");
    setShown(false);
    setTimeout(() => setVisible(false), 220);
  }

  function next() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const step = steps[stepIndex];

  return (
    <>
      {/* Solid backdrop — blocks all interaction behind it */}
      <div
        className="fixed inset-0 z-[9000]"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={dismiss}
      />

      {/* Bottom sheet — CSS transition only, zero Framer Motion */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9001] px-4 pb-6"
        style={{ pointerEvents: shown ? "auto" : "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-white rounded-3xl p-6 max-w-sm mx-auto"
          style={{
            transform: shown ? "translateY(0)" : "translateY(110%)",
            transition: "transform 0.2s ease",
            boxShadow: "0 -4px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)",
          }}
        >
          {/* Step dots */}
          <div className="flex gap-1.5 justify-center mb-5">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full"
                style={{
                  width: i === stepIndex ? 20 : 6,
                  backgroundColor: i === stepIndex ? "#0d9488" : "#cbd5e1",
                  transition: "width 0.2s ease, background-color 0.2s ease",
                }}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="text-5xl text-center mb-3 leading-none select-none">
            {step.icon}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-slate-900 text-center mb-2 tracking-tight">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Skip */}
          <div className="text-center mb-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-slate-400 hover:text-slate-600 min-h-[28px] px-3"
              style={{ transition: "color 0.15s ease" }}
            >
              Skip
            </button>
          </div>

          {/* Next / Got it */}
          <button
            type="button"
            onClick={next}
            className="w-full min-h-[52px] rounded-2xl bg-[var(--accent)] text-white font-semibold text-base hover:bg-[var(--accent-dark)] active:scale-[0.98]"
            style={{ transition: "background-color 0.15s ease, transform 0.1s ease" }}
          >
            {stepIndex < steps.length - 1 ? "Next →" : "Got it →"}
          </button>
        </div>
      </div>
    </>
  );
}
