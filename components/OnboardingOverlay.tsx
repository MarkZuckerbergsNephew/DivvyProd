"use client";

import { useEffect, useState, useCallback } from "react";

type Step = {
  selector: string;
  text: string;
  placement?: "above" | "below" | "auto";
};

type Props = {
  steps: Step[];
  storageKey: string;
  ready: boolean;
};

export default function OnboardingOverlay({ steps, storageKey, ready }: Props) {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    arrowLeft: number;
    isBelow: boolean;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey) === null) {
      const t = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(t);
    }
  }, [ready, storageKey]);

  const computePos = useCallback(() => {
    if (!visible || steps.length === 0) return;
    const step = steps[stepIndex];
    if (!step) return;

    const el = document.querySelector(step.selector);
    if (!el) {
      setPos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const W = 264;
    const gap = 10;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    let left = rect.left + rect.width / 2 - W / 2;
    left = Math.max(12, Math.min(left, viewW - W - 12));

    const arrowLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - left, W - 12));

    const wantPlacement = step.placement ?? "auto";
    const spaceBelow = viewH - rect.bottom;
    const isBelow =
      wantPlacement === "below" ||
      (wantPlacement === "auto" && spaceBelow >= 160);

    if (isBelow) {
      setPos({ top: rect.bottom + gap, left, arrowLeft, isBelow: true });
    } else {
      setPos({ bottom: viewH - rect.top + gap, left, arrowLeft, isBelow: false });
    }
  }, [visible, stepIndex, steps]);

  useEffect(() => {
    computePos();
    window.addEventListener("resize", computePos);
    window.addEventListener("scroll", computePos, true);
    return () => {
      window.removeEventListener("resize", computePos);
      window.removeEventListener("scroll", computePos, true);
    };
  }, [computePos]);

  function dismiss() {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, "true");
    setVisible(false);
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
  const isBelow = pos?.isBelow ?? true;

  const tooltipStyle: React.CSSProperties = pos
    ? {
        width: 264,
        ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
        left: pos.left,
      }
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        width: 264,
      };

  const arrowLeft = pos ? pos.arrowLeft - 6 : 126;

  return (
    <>
      {/* Dim overlay */}
      <div
        className="fixed inset-0 z-[9000] pointer-events-none"
        style={{ background: "rgba(0,0,0,0.08)" }}
      />

      {/* Tap-outside = dismiss */}
      <div className="fixed inset-0 z-[9001]" onClick={dismiss} />

      {/* Tooltip */}
      <div
        className="fixed z-[9002] bg-white rounded-2xl border border-slate-200 p-4"
        style={{
          ...tooltipStyle,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow */}
        {pos && (
          <span
            className="absolute w-[13px] h-[13px] bg-white rotate-45"
            style={{
              left: arrowLeft,
              ...(isBelow
                ? {
                    top: -7,
                    borderTop: "1px solid #e2e8f0",
                    borderLeft: "1px solid #e2e8f0",
                  }
                : {
                    bottom: -7,
                    borderBottom: "1px solid #e2e8f0",
                    borderRight: "1px solid #e2e8f0",
                  }),
            }}
          />
        )}

        <p className="text-sm text-slate-700 leading-relaxed">{step.text}</p>

        <div className="flex items-center justify-between mt-3">
          {/* Step dots */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === stepIndex ? "bg-teal-500" : "bg-slate-300"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors min-h-[28px] px-1"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={next}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors min-h-[28px] px-1"
            >
              {stepIndex < steps.length - 1 ? "Next →" : "Got it →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
