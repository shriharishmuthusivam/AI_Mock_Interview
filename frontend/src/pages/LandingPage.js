import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import AnimatedBackground from "../components/AnimatedBackground";
import GradientButton from "../components/GradientButton";
import { colors, gradients, fonts, radius } from "../styles/theme";

const FEATURES = [
  {
    icon: "🎤",
    title: "AI Interviews",
    text: "Real-time technical interview experience.",
  },
  {
    icon: "📊",
    title: "Performance Tracking",
    text: "View scores, feedback and interview history.",
  },
  {
    icon: "🖥",
    title: "CS Subjects",
    text: "DBMS, OOPs, DSA, OS, CN and more.",
  },
];

function LandingPage() {
  const navigate = useNavigate();

  return (
    <AnimatedBackground>
      <div style={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={styles.card}
        >
          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            style={styles.badge}
          >
            Proctored · AI Powered
          </motion.p>

          <h1 style={styles.title}>
            AI Mock{" "}
            <span
              style={{
                background: gradients.text,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Interviewer
            </span>
          </h1>

          <p style={styles.subtitle}>
            AI-powered technical interview platform for
            Computer Science students — with live proctoring
            and instant scoring.
          </p>

          <div style={styles.buttonContainer}>
            <GradientButton
              onClick={() => navigate("/student-login")}
              style={styles.studentBtn}
            >
              🎓 Student Login
            </GradientButton>

            <GradientButton
              onClick={() => navigate("/interviewer-login")}
              gradient={gradients.accent}
            >
              📋 Interviewer Login
            </GradientButton>
          </div>

          <div style={styles.features}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.12, duration: 0.45 }}
                whileHover={{ y: -6, scale: 1.02 }}
                style={styles.featureCard}
              >
                <span style={styles.featureIcon}>{f.icon}</span>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureText}>{f.text}</p>
              </motion.div>
            ))}
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
    maxWidth: 920,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    padding: "50px 40px",
    borderRadius: radius.xl,
    textAlign: "center",
    border: `1px solid ${colors.border}`,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },

  badge: {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: radius.pill,
    background: "rgba(34,211,238,0.12)",
    border: "1px solid rgba(34,211,238,0.35)",
    color: colors.accent,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    margin: "0 0 20px",
  },

  title: {
    color: colors.text,
    fontSize: 54,
    fontWeight: 800,
    margin: "0 0 16px",
    lineHeight: 1.15,
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 18,
    maxWidth: 560,
    margin: "0 auto 36px",
    lineHeight: 1.6,
  },

  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginBottom: 44,
    flexWrap: "wrap",
  },

  studentBtn: {
    padding: "14px 30px",
  },

  features: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 18,
  },

  featureCard: {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${colors.border}`,
    padding: "24px 22px",
    borderRadius: radius.lg,
    textAlign: "left",
    cursor: "default",
  },

  featureIcon: {
    fontSize: 30,
    display: "block",
    marginBottom: 12,
  },

  featureTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: 700,
    margin: "0 0 8px",
  },

  featureText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
  },
};

export default LandingPage;
