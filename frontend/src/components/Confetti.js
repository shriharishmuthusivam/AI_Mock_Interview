import React, { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = [
  "#2563eb",
  "#7c3aed",
  "#22d3ee",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

function Confetti({ count = 60 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length],
        sway: Math.random() * 60 - 30,
      })),
    [count]
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: `${p.left}vw`,
            y: "-10vh",
            opacity: 1,
            rotate: 0,
          }}
          animate={{
            y: "110vh",
            x: `calc(${p.left}vw + ${p.sway}px)`,
            rotate: p.rotate,
            opacity: [1, 1, 0.6],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
            repeat: Infinity,
            repeatDelay: 0.5,
          }}
          style={{
            position: "absolute",
            top: 0,
            width: p.size,
            height: p.size * 0.45,
            borderRadius: 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

export default Confetti;
