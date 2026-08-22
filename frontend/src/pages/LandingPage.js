import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";

import AnimatedBackground from "../components/AnimatedBackground";
import GradientButton from "../components/GradientButton";
import { colors, gradients, fonts, radius, shadows } from "../styles/theme";

const FEATURES = [
  {
    icon: "🤖",
    title: "MCQ Interviews",
    text: "AI-generated multiple-choice mock interviews — no typing, just think and pick.",
  },
  {
    icon: "📊",
    title: "Performance Tracking",
    text: "Scores, AI summaries and complete interview history in one dashboard.",
  },
  {
    icon: "🧠",
    title: "AI & ML Subjects",
    text: "Machine Learning, Deep Learning, NLP, Computer Vision, Data Science and more.",
  },
  {
    icon: "🎥",
    title: "Live Proctoring",
    text: "Camera-monitored sessions that keep every interview honest.",
  },
  {
    icon: "⚡",
    title: "Instant Scoring",
    text: "Every choice is auto-graded instantly, with an AI summary at the end.",
  },
  {
    icon: "📚",
    title: "Syllabus-based",
    text: "Every question is generated fresh from your class's own syllabus.",
  },
];

const STATS = [
  { to: 10, suffix: "+", label: "AI/ML Subjects" },
  { to: 60, suffix: "", label: "Max Questions" },
  { icon: "⚡", label: "Instant Scoring" },
  { icon: "🛡️", label: "Live Proctoring" },
];

const STEPS = [
  {
    icon: "📝",
    title: "Prepare",
    text: "Interviewers upload students and paste the class syllabus.",
  },
  {
    icon: "🤖",
    title: "Interview",
    text: "Students log in and answer AI-generated multiple-choice questions, one at a time.",
  },
  {
    icon: "🎯",
    title: "Score",
    text: "Instant score, per-question breakdown and an AI summary — tracked in the dashboard.",
  },
];

const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const sectionReveal = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

function Counter({ to, suffix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;

    let raf;
    const start = performance.now();
    const duration = 1100;

    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

function MockPanel() {
  return (
    <div style={styles.panelWrap}>
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={styles.panel}
      >
        <div style={styles.panelHeader}>
          <div style={styles.panelUser}>
            <div style={styles.panelAvatar}>🤖</div>
            <div>
              <div style={styles.panelName}>AI Interviewer</div>
              <div style={styles.panelMeta}>Deep Learning · Q2 / 10</div>
            </div>
          </div>

          <div style={styles.liveBadge}>
            <motion.span
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              style={styles.liveDot}
            />
            LIVE
          </div>
        </div>

        <div style={styles.questionBubble}>
          Which optimizer uses momentum to accelerate convergence in deep
          networks?
        </div>

        <div style={styles.mcqList}>
          {[
            { letter: "A", text: "Stochastic Gradient Descent" },
            { letter: "B", text: "RMSprop" },
            { letter: "C", text: "Adam", correct: true },
            { letter: "D", text: "Adagrad" },
          ].map((o) => (
            <motion.div
              key={o.letter}
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              style={{
                ...styles.mcqOption,
                ...(o.correct ? styles.mcqOptionCorrect : null),
              }}
            >
              <span
                style={{
                  ...styles.mcqLetter,
                  ...(o.correct ? styles.mcqLetterCorrect : null),
                }}
              >
                {o.letter}
              </span>
              <span style={styles.mcqText}>{o.text}</span>
              {o.correct ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 1.2,
                    type: "spring",
                    stiffness: 300,
                    damping: 16,
                  }}
                  style={styles.mcqCheck}
                >
                  ✓ Correct
                </motion.span>
              ) : null}
            </motion.div>
          ))}
        </div>

        <GradientButton
          gradient={gradients.accent}
          style={styles.nextBtn}
          onClick={() => {}}
        >
          Next Question →
        </GradientButton>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        style={styles.chip1}
      >
        ✓ Scored 87%
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0], rotate: [0, -2, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={styles.chip2}
      >
        📊 Instant feedback
      </motion.div>
    </div>
  );
}

function AdminFloatButton() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
      style={styles.adminFloatWrap}
    >
      <motion.span
        animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        style={styles.adminRing}
      />

      <motion.button
        onClick={() => navigate("/admin-login")}
        whileHover={{
          scale: 1.06,
          y: -2,
          boxShadow: "0 0 26px rgba(34,211,238,0.55)",
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        style={styles.adminFloat}
      >
        <motion.span
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={styles.adminShield}
        >
          🛡️
        </motion.span>
        Admin
      </motion.button>
    </motion.div>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  return (
    <AnimatedBackground>
      <div style={styles.container}>
        {/* HERO */}
        <motion.section
          variants={heroStagger}
          initial="hidden"
          animate="show"
          style={styles.hero}
        >
          <motion.div variants={heroItem} style={styles.heroLeft}>
            <motion.p style={styles.badge}>
              Department of Artificial Intelligence
            </motion.p>

            <h1 style={styles.title}>
              Practice. Get Scored.{" "}
              <span style={styles.titleGradient}>Get Hired.</span>
            </h1>

            <p style={styles.subtitle}>
              The official mock interview platform of the Department of
              Artificial Intelligence,{" "}
              <span style={styles.subtitleStrong}>
                St. Joseph's College (Autonomous), Tiruchirappalli
              </span>{" "}
              — syllabus-driven multiple-choice interviews with instant scoring
              and live proctoring for our AI &amp; ML students.
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

            <div style={styles.statsRow}>
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                  style={styles.statCard}
                >
                  <div style={styles.statValue}>
                    {s.to ? (
                      <Counter to={s.to} suffix={s.suffix} />
                    ) : (
                      <span>{s.icon}</span>
                    )}
                  </div>
                  <div style={styles.statLabel}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={heroItem}
            transition={{ delay: 0.25 }}
            style={styles.heroRight}
          >
            <MockPanel />
          </motion.div>
        </motion.section>

        {/* FEATURES */}
        <motion.section
          variants={sectionReveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          style={styles.section}
        >
          <h2 style={styles.sectionTitle}>
            Everything you need to{" "}
            <span style={styles.sectionTitleGradient}>ace interviews</span>
          </h2>

          <div style={styles.features}>
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                style={styles.featureCard}
              >
                <span style={styles.featureIcon}>{f.icon}</span>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureText}>{f.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* HOW IT WORKS */}
        <motion.section
          variants={sectionReveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          style={styles.section}
        >
          <h2 style={styles.sectionTitle}>
            How it{" "}
            <span style={styles.sectionTitleGradient}>works</span>
          </h2>

          <div style={styles.steps}>
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                style={styles.stepCard}
              >
                <div style={styles.stepNumber}>{i + 1}</div>
                <div style={styles.stepIcon}>{s.icon}</div>
                <h3 style={styles.stepTitle}>{s.title}</h3>
                <p style={styles.stepText}>{s.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* FOOTER */}
        <footer style={styles.footer}>
          <span style={styles.footerBrand}>🎙️ AI Mock Interviewer</span>
          <span style={styles.footerText}>
            Built for the Department of Artificial Intelligence, St. Joseph's
            College (Autonomous), Tiruchirappalli.
          </span>
          <div style={styles.footerCredit}>
            Built with ❤️ by Shri Harish V M (25PAI801)
          </div>
        </footer>
      </div>

      <AdminFloatButton />
    </AnimatedBackground>
  );
}

const styles = {
  container: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "72px 28px 48px",
    fontFamily: fonts.family,
  },

  hero: {
    display: "flex",
    alignItems: "center",
    gap: 56,
    flexWrap: "wrap",
    marginBottom: 96,
  },

  heroLeft: {
    flex: 1.15,
    minWidth: 320,
  },

  heroRight: {
    flex: 1,
    minWidth: 320,
    display: "flex",
    justifyContent: "center",
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
    margin: "0 0 22px",
  },

  title: {
    color: colors.text,
    fontSize: 58,
    fontWeight: 800,
    margin: "0 0 18px",
    lineHeight: 1.1,
    letterSpacing: "-0.5px",
  },

  titleGradient: {
    background: gradients.text,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    maxWidth: 540,
    margin: "0 0 30px",
    lineHeight: 1.65,
  },

  subtitleStrong: {
    color: colors.text,
    fontWeight: 600,
  },

  buttonContainer: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 14,
  },

  studentBtn: {
    padding: "14px 30px",
  },

  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
    maxWidth: 540,
    marginTop: 26,
  },

  statCard: {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "14px 16px",
    textAlign: "center",
  },

  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: 800,
    background: gradients.text,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: 2,
  },

  statLabel: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: "0.3px",
  },

  panelWrap: {
    position: "relative",
    width: "100%",
    maxWidth: 440,
  },

  panel: {
    background: "rgba(15,23,42,0.72)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: `1px solid rgba(255,255,255,0.12)`,
    borderRadius: radius.xl,
    padding: "24px",
    boxShadow: shadows.glow,
  },

  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  panelUser: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  panelAvatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    background: gradients.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  panelName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 700,
  },

  panelMeta: {
    color: colors.textMuted,
    fontSize: 12.5,
    marginTop: 2,
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#f87171",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "1px",
    padding: "6px 12px",
    borderRadius: radius.pill,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.35)",
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#ef4444",
    display: "inline-block",
  },

  questionBubble: {
    background: "rgba(255,255,255,0.07)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: "16px 18px",
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 1.6,
    marginBottom: 12,
  },

  mcqList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 16,
  },

  mcqOption: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "11px 14px",
    cursor: "default",
  },

  mcqOptionCorrect: {
    background: "rgba(34,197,94,0.13)",
    border: "1px solid rgba(34,197,94,0.45)",
  },

  mcqLetter: {
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    fontFamily: fonts.mono,
    background: "rgba(255,255,255,0.08)",
    border: `1px solid ${colors.border}`,
    color: colors.textMuted,
  },

  mcqLetterCorrect: {
    background: "rgba(34,197,94,0.22)",
    border: "1px solid rgba(34,197,94,0.55)",
    color: "#86efac",
  },

  mcqText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },

  mcqCheck: {
    color: "#86efac",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
  },

  nextBtn: {
    width: "100%",
    padding: "13px 22px",
    fontSize: 14,
  },

  chip1: {
    position: "absolute",
    top: -18,
    right: -14,
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.4)",
    color: "#86efac",
    fontSize: 13,
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: radius.pill,
  },

  chip2: {
    position: "absolute",
    bottom: -16,
    left: -14,
    background: "rgba(124,58,237,0.16)",
    border: "1px solid rgba(124,58,237,0.45)",
    color: "#c4b5fd",
    fontSize: 13,
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: radius.pill,
  },

  section: {
    marginBottom: 96,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 36,
    fontWeight: 800,
    textAlign: "center",
    margin: "0 0 44px",
    letterSpacing: "-0.3px",
  },

  sectionTitleGradient: {
    background: gradients.text,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  features: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
  },

  featureCard: {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${colors.border}`,
    padding: "26px 24px",
    borderRadius: radius.lg,
    cursor: "default",
  },

  featureIcon: {
    fontSize: 30,
    display: "block",
    marginBottom: 14,
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
    lineHeight: 1.55,
    margin: 0,
  },

  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20,
  },

  stepCard: {
    position: "relative",
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: "32px 26px",
    textAlign: "center",
  },

  stepNumber: {
    position: "absolute",
    top: 14,
    left: 18,
    color: colors.textDim,
    fontSize: 13,
    fontWeight: 800,
    fontFamily: fonts.mono,
  },

  stepIcon: {
    fontSize: 34,
    marginBottom: 14,
  },

  stepTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 700,
    margin: "0 0 8px",
  },

  stepText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.55,
    margin: 0,
  },

  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    flexWrap: "wrap",
    padding: "28px 0 8px",
    borderTop: `1px solid ${colors.border}`,
  },

  footerBrand: {
    color: colors.text,
    fontWeight: 700,
    fontSize: 14,
  },

  footerText: {
    color: colors.textDim,
    fontSize: 13,
  },

  footerCredit: {
    width: "100%",
    textAlign: "center",
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.5px",
    marginTop: 2,
  },

  adminFloatWrap: {
    position: "fixed",
    top: 20,
    right: 20,
    zIndex: 90,
  },

  adminRing: {
    position: "absolute",
    inset: 0,
    borderRadius: radius.pill,
    border: "1px solid rgba(34,211,238,0.55)",
    pointerEvents: "none",
  },

  adminFloat: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: radius.pill,
    background: "rgba(15,23,42,0.8)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(34,211,238,0.35)",
    color: colors.text,
    fontSize: 13.5,
    fontWeight: 700,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
  },

  adminShield: {
    display: "inline-block",
    fontSize: 16,
  },
};

export default LandingPage;
