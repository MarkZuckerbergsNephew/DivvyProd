"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div
      className="fixed inset-0 z-0 bg-app-canvas bg-app-dots overflow-hidden"
      aria-hidden
    >
      {/* Animated gradient layer */}
      <div className="absolute inset-0 bg-app-glow animate-gradient-drift" />

      {/* Floating blobs — slow, subtle motion */}
      <motion.div
        className="absolute rounded-full bg-teal-200/30 blur-3xl"
        style={{
          width: "min(80vw, 400px)",
          height: "min(80vw, 400px)",
          left: "10%",
          top: "15%",
        }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -25, 15, 0],
          scale: [1, 1.08, 0.95, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute rounded-full bg-slate-200/25 blur-3xl"
        style={{
          width: "min(60vw, 280px)",
          height: "min(60vw, 280px)",
          right: "5%",
          bottom: "20%",
        }}
        animate={{
          x: [0, -40, 25, 0],
          y: [0, 20, -15, 0],
          scale: [1, 0.92, 1.05, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute rounded-full bg-teal-100/40 blur-3xl"
        style={{
          width: "min(50vw, 220px)",
          height: "min(50vw, 220px)",
          left: "30%",
          top: "55%",
        }}
        animate={{
          x: [0, 25, -20, 0],
          y: [0, -20, 25, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
