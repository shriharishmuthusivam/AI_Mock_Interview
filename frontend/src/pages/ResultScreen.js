import React, { useState } from "react";

import AnimatedBackground from "../components/AnimatedBackground";
import Confetti from "../components/Confetti";
import CountUp from "../components/CountUp";
import ScoreRing from "../components/ScoreRing";
import { colors, fonts, radius, gradients } from "../styles/theme";
import { motion } from "framer-motion";

function ResultScreen({ totalScore, maxScore, onRestart, onLogout }) {
  const [celebrate] = useState(totalScore >= 40);

  let performance = "";
  let verdictColor = colors.success;

  if (totalScore >= 80) {
    performance = "Excellent";
    verdictColor = "#4ade80";
  } else if (totalScore >= 60) {
    performance = "Good";
    verdictColor = "#60a5fa";
  } else if (totalScore >= 40) {
    performance = "Average";
    verdictColor = "#fbbf24";
  } else {
    performance = "Needs Improvement";
    verdictColor = "#f87171";
  }

  const strengths =
    totalScore >= 60
      ? "Strong understanding of core computer science concepts with clear, structured answers."
      : totalScore >= 40
      ? "Decent grasp of core concepts; answers show a working understanding of the topics."
      : "Familiar with some concepts, but answers need stronger technical depth and clarity.";

  const weaknesses =
    totalScore >= 60
      ? "Occasionally rushed answers; adding more examples and edge-case reasoning will push scores higher."
      : totalScore >= 40
      ? "Focus on improving explanation structure and covering missing points in answers."
      : "Revisit the core topics and practice explaining concepts step by step before retaking.";

  return (
    <AnimatedBackground>
      {celebrate && <Confetti />}

      <div style={styles.container}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={styles.card}
        >
          <h1 style={styles.title}>Interview Completed</h1>

          <p style={styles.subtitle}>Here is your performance summary</p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={styles.ringWrap}
          >
            <ScoreRing
              value={totalScore}
              max={maxScore}
              size={210}
              color={verdictColor}
            >
              <span style={{ ...styles.ringCaption, color: verdictColor }}>
                <CountUp value={totalScore} /> pts
              </span>
            </ScoreRing>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            style={{ ...styles.performance, color: verdictColor }}
          >
            {performance}
          </motion.h2>

          <div style={styles.sectionGrid}>
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              style={styles.section}
            >
              <span style={styles.sectionIcon}>💪</span>

              <h3>Strengths</h3>

              <p>{strengths}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              style={styles.section}
            >
              <span style={styles.sectionIcon}>🎯</span>

              <h3>Weaknesses</h3>

              <p>{weaknesses}</p>
            </motion.div>
          </div>

          <div style={styles.actions}>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRestart}
              style={styles.actionButton}
            >
              🔁 Take Another Interview
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLogout}
              style={styles.logoutButton}
            >
              Logout
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatedBackground>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    fontFamily: fonts.family,
  },

  card: {
    width: "100%",
    maxWidth: 640,
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    padding: "40px 40px 44px",
    borderRadius: radius.xl,
    textAlign: "center",
    border: `1px solid ${colors.border}`,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },

  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: 800,
    margin: "0 0 8px",
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    margin: "0 0 26px",
  },

  ringWrap: {
    display: "flex",
    justifyContent: "center",
  },

  ringCaption: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: fonts.mono,
  },

  performance: {
    margin: "18px 0 26px",
    fontSize: 26,
    fontWeight: 800,
  },

  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },

  section: {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${colors.border}`,
    padding: "20px",
    borderRadius: radius.lg,
    textAlign: "left",
  },

  sectionIcon: {
    fontSize: 26,
    display: "block",
    marginBottom: 10,
  },

  sectionTitle: {
    color: colors.text,
    margin: "0 0 8px",
  },

  actions: {
    display: "flex",
    justifyContent: "center",
    gap: 14,
    marginTop: 28,
    flexWrap: "wrap",
  },

  actionButton: {
    padding: "13px 26px",
    borderRadius: radius.pill,
    border: "none",
    background: gradients.primary,
    color: "white",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
  },

  logoutButton: {
    padding: "13px 26px",
    borderRadius: radius.pill,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(239,68,68,0.12)",
    color: "#fca5a5",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
  },
};

export default ResultScreen;
