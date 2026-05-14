"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

export type ScannedItem = { name: string; price: number };
export type ScannedReceipt = { items: ScannedItem[]; tax: number; tip: number };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (receipt: ScannedReceipt) => Promise<void>;
  /** Called with the image file; returns extracted items plus detected tax/tip. */
  onExtractItems: (file: File) => Promise<ScannedReceipt>;
};

export default function ScanReceiptModal({
  isOpen,
  onClose,
  onAddItems,
  onExtractItems,
}: Props) {
  const [step, setStep] = useState<"capture" | "review">("capture");
  const [captureMode, setCaptureMode] = useState<"choose" | "camera">("choose");
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [detectedTax, setDetectedTax] = useState(0);
  const [detectedTip, setDetectedTip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep("capture");
      setCaptureMode("choose");
      setItems([]);
      setDetectedTax(0);
      setDetectedTip(0);
      setError(null);
    }
    return () => stopCamera();
  }, [isOpen, stopCamera]);

  useEffect(() => {
    if (captureMode === "camera" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [captureMode]);

  if (!isOpen) return null;

  function handleClose() {
    stopCamera();
    setStep("capture");
    setCaptureMode("choose");
    setItems([]);
    setDetectedTax(0);
    setDetectedTip(0);
    setError(null);
    onClose();
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      );
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCaptureMode("camera");
    } catch (e) {
      setError("Camera access denied or unavailable. Use “Choose from library” instead.");
    }
  }

  function captureFromCamera() {
    const video = videoRef.current;
    if (!video || !streamRef.current || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "receipt.jpg", { type: "image/jpeg" });
        stopCamera();
        setCaptureMode("choose");
        handleFileSelect(file);
      },
      "image/jpeg",
      0.92
    );
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setLoading(true);
    onExtractItems(file)
      .then(({ items: extracted, tax, tip }) => {
        setItems(extracted.length > 0 ? extracted : [{ name: "", price: 0 }]);
        setDetectedTax(tax);
        setDetectedTip(tip);
        setStep("review");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not read receipt. Try another photo.")
      )
      .finally(() => setLoading(false));
  }

  function handleAddAll() {
    const valid = items.filter((i) => i.name.trim() && !isNaN(i.price) && i.price >= 0);
    if (valid.length === 0) return;
    setError(null);
    setLoading(true);
    onAddItems({ items: valid, tax: detectedTax, tip: detectedTip })
      .then(() => handleClose())
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to add items. Try again.")
      )
      .finally(() => setLoading(false));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: "name" | "price", value: string | number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? field === "name"
            ? { ...item, name: String(value) }
            : { ...item, price: Number(value) || 0 }
          : item
      )
    );
  }

  function addRow() {
    setItems((prev) => [...prev, { name: "", price: 0 }]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={() => !loading && step === "capture" && handleClose()}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-receipt-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="relative w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-slate-200/80 flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 id="scan-receipt-title" className="text-lg font-semibold text-slate-900">
            {step === "capture" ? "Scan receipt" : "Review items"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl" role="alert">
              {error}
            </p>
          )}

          {step === "capture" && (
            <>
              {loading ? (
                <div className="py-12 text-center">
                  <p className="text-slate-600 font-medium">Reading receipt…</p>
                  <div className="mt-4 w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : captureMode === "camera" ? (
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] max-h-[60vh] w-full overflow-hidden rounded-xl bg-slate-900">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setCaptureMode("choose");
                      }}
                      className="flex-1 min-h-[48px] rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      className="flex-1 min-h-[48px] rounded-xl bg-teal-500 text-white font-semibold hover:bg-teal-600 active:scale-[0.98] transition-all"
                    >
                      Capture
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    Take photo
                  </button>
                  <label className="block">
                    <span className="sr-only">Choose from library or files</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                        e.target.value = "";
                      }}
                    />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Choose from library or files
                    </span>
                  </label>
                </div>
              )}
            </>
          )}

          {step === "review" && (
            <>
              <p className="text-sm text-slate-600">Edit items below, then add them to the split.</p>
              {(detectedTax > 0 || detectedTip > 0) && (
                <div className="flex flex-col gap-1 px-3 py-2.5 bg-teal-50 border border-teal-100 rounded-xl text-sm text-teal-800">
                  {detectedTax > 0 && (
                    <span>Tax detected: <strong>${detectedTax.toFixed(2)}</strong> — will be auto-filled</span>
                  )}
                  {detectedTip > 0 && (
                    <span>Tip detected: <strong>${detectedTip.toFixed(2)}</strong> — will be auto-filled</span>
                  )}
                </div>
              )}
              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li
                    key={index}
                    className="flex gap-2 items-center p-3 rounded-xl border border-slate-200 bg-slate-50/50"
                  >
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      placeholder="Item name"
                      className="flex-1 min-w-0 min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={item.price > 0 ? item.price : ""}
                      onChange={(e) => updateItem(index, "price", e.target.value)}
                      placeholder="$"
                      className="w-20 min-h-[40px] px-2 rounded-lg border border-slate-200 bg-white text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                      aria-label="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={addRow}
                className="w-full min-h-[44px] rounded-xl border border-dashed border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                + Add row
              </button>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2 bg-white">
          {step === "review" && (
            <>
              <button
                type="button"
                onClick={handleAddAll}
                disabled={loading || !items.some((i) => i.name.trim() && i.price > 0)}
                className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Adding…" : "Add all to split"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("capture");
                  setCaptureMode("choose");
                }}
                disabled={loading}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
