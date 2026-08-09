import React from "react";
import { motion } from "framer-motion";

// Drifting aurora/gradient orbs + subtle grid used behind every page
function AnimatedBackground({ children }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.base} />

      <motion.div
        style={styles.orb1}
        animate={{
          x: [0, 60, -40, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        style={styles.orb2}
        animate={{
          x: [0, -70, 50, 0],
          y: [0, 40, -60, 0],
          scale: [1, 0.9, 1.2, 1],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        style={styles.orb3}
        animate={{
          x: [0, 40, -50, 0],
          y: [0, 30, -30, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div style={styles.grid} />

      <div style={styles.content}>{children}</div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    minHeight: "100vh",
    overflow: "hidden",
  },

  base: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(37,99,235,0.28), transparent 60%), radial-gradient(1000px 500px at 90% 10%, rgba(124,58,237,0.28), transparent 60%), linear-gradient(160deg, #020617 0%, #0f172a 100%)",
  },

  orb1: {
    position: "absolute",
    top: "-10%",
    left: "8%",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(37,99,235,0.35), transparent 65%)",
    filter: "blur(60px)",
  },

  orb2: {
    position: "absolute",
    bottom: "-15%",
    right: "5%",
    width: 460,
    height: 460,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(124,58,237,0.32), transparent 65%)",
    filter: "blur(60px)",
  },

  orb3: {
    position: "absolute",
    top: "40%",
    right: "35%",
    width: 300,
    height: 300,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(34,211,238,0.18), transparent 65%)",
    filter: "blur(50px)",
  },

  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)",
    backgroundSize: "44px 44px",
    maskImage:
      "radial-gradient(ellipse 80% 70% at 50% 30%, black, transparent)",
    WebkitMaskImage:
      "radial-gradient(ellipse 80% 70% at 50% 30%, black, transparent)",
  },

  content: {
    position: "relative",
    zIndex: 1,
  },
};

export default AnimatedBackground;
