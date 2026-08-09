import React from "react";
import { motion } from "framer-motion";

// Three bouncing dots shown while the AI is "typing"
function TypingIndicator() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "12px 16px",
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#60a5fa",
          }}
        />
      ))}
    </div>
  );
}

export default TypingIndicator;
