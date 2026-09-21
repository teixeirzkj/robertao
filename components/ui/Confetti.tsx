"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = ["#e2b83c", "#f0d97a", "#ffe9a8", "#ff5a68", "#ffffff"];

/** Chuva de confete leve, puramente decorativa. */
export default function Confetti({ pieces = 70 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.4 + Math.random() * 1.8,
        size: 5 + Math.random() * 7,
        rotate: Math.random() * 720 - 360,
        drift: Math.random() * 120 - 60,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() > 0.6,
      })),
    [pieces]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: "-12%", x: 0, opacity: 0, rotate: 0 }}
          animate={{ y: "115%", x: p.drift, opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 1.9),
            backgroundColor: p.color,
            borderRadius: p.round ? "9999px" : "2px",
          }}
          className="absolute top-0"
        />
      ))}
    </div>
  );
}
