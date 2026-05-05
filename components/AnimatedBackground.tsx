"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function AnimatedBackground() {
  // Start as mobile (static) to match SSR; update after mount
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 bg-app-canvas bg-app-dots overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-app-glow animate-gradient-drift" />

      {!isMobile && (
        /* Single animated blob on desktop only */
        <motion.div
          className="absolute rounded-full bg-teal-200/25 blur-3xl"
          style={{
            width: "min(60vw, 360px)",
            height: "min(60vw, 360px)",
            left: "15%",
            top: "20%",
          }}
          animate={{ x: [0, 28, -18, 0], y: [0, -22, 14, 0], scale: [1, 1.06, 0.96, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
