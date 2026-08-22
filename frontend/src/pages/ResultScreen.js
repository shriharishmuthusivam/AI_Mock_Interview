import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import AnimatedBackground from "../components/AnimatedBackground";
import Confetti from "../components/Confetti";
import CountUp from "../components/CountUp";
import ScoreRing from "../components/ScoreRing";
import { colors, fonts, radius, gradients } from "../styles/theme";
import { AnimatePresence, motion } from "framer-motion";

function ResultScreen({
  totalScore,
  maxScore,
  resultData,
  onRestart,
  onLogout,
}) {
  const navigate = useNavigate();

  const [celebrate] = useState(
    maxScore > 0 ? totalScore / maxScore >= 0.6 : false
  );

  const [showBreakdown, setShowBreakdown] =
    useState(false);

  const pct = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  let performance = "";
  let verdictColor = colors.success;

  if (pct >= 80) {
    performance = "Excellent";
    verdictColor = "#4ade80";
  } else if (pct >= 60) {
    performance = "Good";
    verdictColor = "#60a5fa";
  } else if (pct >= 40) {
    performance = "Average";
    verdictColor = "#fbbf24";
  } else {
    performance = "Needs Improvement";
    verdictColor = "#f87171";
  }

  const breakdown =
    resultData && Array.isArray(resultData.breakdown)
      ? resultData.breakdown
      : [];

  const hasDetails =
    Boolean(resultData) &&
    (Boolean(resultData.summary) || breakdown.length > 0);

  return (
    <AnimatedBackground>
      {celebrate && <Confetti />}

      <div style={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={styles.backLink}
          onClick={() => navigate("/")}
        >
          ← Back
        </motion.div>

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
                <CountUp value={totalScore} /> / {maxScore} correct
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

          {hasDetails ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                style={styles.summaryCard}
              >
                <span style={styles.sectionIcon}>💬</span>

                <h3 style={styles.sectionHeading}>
                  Interviewer's Summary
                </h3>

                <p style={styles.summaryText}>
                  {resultData.summary ||
                    "No summary available for this session."}
                </p>
              </motion.div>

              {breakdown.length > 0 && (
                <>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() =>
                      setShowBreakdown((v) => !v)
                    }
                    style={styles.reviewToggle}
                  >
                    {showBreakdown ? "▴ Hide" : "▾ Review"} your{" "}
                    {breakdown.length} question
                    {breakdown.length === 1 ? "" : "s"}
                  </motion.button>

                  <AnimatePresence>
                    {showBreakdown && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        style={styles.breakdownWrap}
                      >
                        {breakdown.map((item, i) => (
                          <div
                            key={`review-${i}`}
                            style={{
                              ...styles.reviewItem,
                              ...(item.correct
                                ? styles.reviewCorrect
                                : styles.reviewWrong),
                            }}
                          >
                            <div style={styles.reviewHead}>
                              <span
                                style={{
                                  ...styles.reviewBadge,
                                  ...(item.correct
                                    ? styles.badgeOk
                                    : styles.badgeMiss),
                                }}
                              >
                                {item.correct ? "✓" : "✗"}
                              </span>

                              <span style={styles.reviewQuestion}>
                                {item.text}
                              </span>
                            </div>

                            <div style={styles.reviewRow}>
                              <span style={styles.reviewLabel}>
                                Your answer:
                              </span>

                              <span
                                style={
                                  item.correct
                                    ? styles.answerOk
                                    : styles.answerMiss
                                }
                              >
                                {item.yourAnswer || "—"}
                              </span>
                            </div>

                            {!item.correct &&
                              item.correctAnswer && (
                                <div style={styles.reviewRow}>
                                  <span style={styles.reviewLabel}>
                                    Correct answer:
                                  </span>

                                  <span style={styles.answerOk}>
                                    {item.correctAnswer}
                                  </span>
                                </div>
                              )}

                            {!item.correct &&
                              item.expectedPoints && (
                                <p style={styles.expectedPoints}>
                                  📌 Know this:{" "}
                                  {item.expectedPoints}
                                </p>
                              )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </>
          ) : (
            <div style={styles.sectionGrid}>
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                style={styles.section}
              >
                <span style={styles.sectionIcon}>💪</span>

                <h3>Strengths</h3>

                <p>
                  {pct >= 60
                    ? "Solid grasp of the verified syllabus questions — keep the momentum going."
                    : pct >= 40
                    ? "Decent grasp of core concepts; review the topics you missed."
                    : "Familiar with some concepts, but fundamentals need stronger revision."}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                style={styles.section}
              >
                <span style={styles.sectionIcon}>🎯</span>

                <h3>Weaknesses</h3>

                <p>
                  {pct >= 60
                    ? "Occasionally rushed picks; read every option carefully before answering."
                    : pct >= 40
                    ? "Focus on improving recall of definitions and concept comparisons."
                    : "Revisit the core topics step by step before retaking."}
                </p>
              </motion.div>
            </div>
          )}

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
    position: "relative",
  },

  backLink: {
    position: "absolute",
    top: 24,
    left: 24,
    color: colors.textMuted,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    transition: "color 0.2s",
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

  summaryCard: {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${colors.border}`,
    padding: "22px",
    borderRadius: radius.lg,
    textAlign: "left",
    marginBottom: 14,
  },

  sectionHeading: {
    color: colors.text,
    margin: "0 0 10px",
    fontSize: 17,
    fontWeight: 700,
  },

  summaryText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 1.7,
    margin: 0,
    whiteSpace: "pre-wrap",
  },

  reviewToggle: {
    width: "100%",
    padding: "12px 18px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.accent,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  breakdownWrap: {
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 12,
  },

  reviewItem: {
    textAlign: "left",
    padding: "16px 18px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  reviewCorrect: {
    borderColor: "rgba(74,222,128,0.35)",
  },

  reviewWrong: {
    borderColor: "rgba(248,113,113,0.35)",
  },

  reviewHead: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },

  reviewBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
  },

  badgeOk: {
    background: "rgba(34,197,94,0.2)",
    color: "#4ade80",
  },

  badgeMiss: {
    background: "rgba(248,113,113,0.2)",
    color: "#f87171",
  },

  reviewQuestion: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.5,
  },

  reviewRow: {
    display: "flex",
    gap: 8,
    fontSize: 13,
    lineHeight: 1.5,
    paddingLeft: 34,
  },

  reviewLabel: {
    color: colors.textMuted,
    flexShrink: 0,
  },

  answerOk: {
    color: "#4ade80",
  },

  answerMiss: {
    color: "#f87171",
  },

  expectedPoints: {
    margin: 0,
    paddingLeft: 34,
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 1.55,
    fontStyle: "italic",
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
