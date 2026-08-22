import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import useProctoring from "../hooks/useProctoring";
import AnimatedBackground from "../components/AnimatedBackground";
import TypingIndicator from "../components/TypingIndicator";
import GradientButton from "../components/GradientButton";
import { useToast } from "../components/Toast";
import api, { getStudentClass } from "../api";
import { colors, fonts, gradients, radius, shadows } from "../styles/theme";

function Interview({
  student,
  setShowResult,
  setTotalScore,
  setMaxScore,
  setResultData,
  onLogout,
}) {
  const navigate = useNavigate();

  const toast = useToast();

  const [current, setCurrent] = useState(null);

  const [totalQuestions, setTotalQuestions] =
    useState(0);

  const [answeredCount, setAnsweredCount] =
    useState(0);

  const [selected, setSelected] = useState(null);

  const [interviewEnded, setInterviewEnded] =
    useState(false);

  const [isSending, setIsSending] = useState(false);

  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState({
    configured: false,
    questionCount: 0,
    verified: false,
  });

  const [className, setClassName] = useState("");

  const [started, setStarted] = useState(false);

  const [startError, setStartError] = useState("");

  const [liveCode, setLiveCode] = useState("");

  const [joiningLive, setJoiningLive] = useState(false);

  const [liveJoinError, setLiveJoinError] = useState("");

  const sessionIdRef = useRef("");

  const startedRef = useRef(false);

  const finalizeRef = useRef(() => {});

  // Finalize the session: the server aggregates every saved answer
  // row, scores deterministically, writes a short AI summary and
  // returns the full per-question breakdown.
  const finalizeInterview = async () => {
    if (!sessionIdRef.current || interviewEnded) return;

    setInterviewEnded(true);

    stopProctoring();

    try {
      const response = await api.post(
        "/api/chat",
        {
          sessionId: sessionIdRef.current,
          finish: true,
        },
        { authRole: "student" }
      );

      const data = response.data;

      setResultData({
        summary: data.summary || "",
        breakdown: Array.isArray(data.breakdown)
          ? data.breakdown
          : [],
      });

      setTotalScore(Number(data.score) || 0);

      setMaxScore(
        Number(data.maxScore) ||
          Number(data.total) ||
          config.questionCount
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Could not load your results. Please check your connection."
      );

      setInterviewEnded(true);
      setIsSending(false);
      return;
    }

    sendReport();

    setTimeout(() => {
      setShowResult(true);
    }, 1600);
  };

  finalizeRef.current = finalizeInterview;

  const {
    violationCount,
    startProctoring,
    stopProctoring,
  } = useProctoring({
    maxWarnings: 3,

    onViolation: (reason, count, max) => {
      toast.warning(
        `WARNING (${count}/${max}): ${reason}`
      );
    },

    onLimitReached: () => {
      finalizeRef.current();
    },
  });

  // Load the student's class interview config
  useEffect(() => {
    const cls = getStudentClass();

    if (!cls) {
      setLoading(false);
      setConfig({ configured: false, questionCount: 0, verified: false });
      return;
    }

    setClassName(cls);

    const load = async () => {
      try {
        const response = await api.get(
          `/api/syllabus/${encodeURIComponent(cls)}`,
          { authRole: "student" }
        );

        setConfig(response.data);
      } catch (error) {
        console.error(error);
        setConfig({ configured: false, questionCount: 0, verified: false });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Send the completed interview transcript as a PDF report to the interviewer
  const sendReport = async () => {
    if (!sessionIdRef.current) return;

    try {
      await api.post(
        "/api/interview/report",
        { sessionId: sessionIdRef.current },
        { authRole: "student" }
      );
    } catch (error) {
      console.error("Failed to send report", error);
    }
  };

  // Start Interview (fetch the first multiple-choice question)
  const beginInterview = async () => {
    if (startedRef.current) return;

    startedRef.current = true;

    setStartError("");

    sessionIdRef.current =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setInterviewEnded(false);

    setAnsweredCount(0);

    setSelected(null);

    setCurrent(null);

    setStarted(true);

    startProctoring();

    try {
      const response = await api.post(
        "/api/chat",
        {
          sessionId: sessionIdRef.current,
          start: true,
          questionCount: config.questionCount,
          questionIndex: 0,
        },
        { authRole: "student" }
      );

      setTotalQuestions(response.data.total || config.questionCount);

      setCurrent(response.data.question);
    } catch (error) {
      console.error(error);

      startedRef.current = false;

      setStarted(false);

      setStartError(
        error.response?.data?.message ||
          "Could not start the interview. Please check that the backend is reachable, then try again."
      );

      stopProctoring();
    }
  };

  // Record a pick. Correctness stays hidden until the result screen.
  const handlePick = async (optionIndex) => {
    if (selected !== null || isSending || interviewEnded) return;

    setSelected(optionIndex);

    setIsSending(true);

    try {
      const response = await api.post(
        "/api/chat",
        {
          sessionId: sessionIdRef.current,
          pickedIndex: optionIndex,
          violationCount,
          questionCount: totalQuestions,
          questionIndex: current.index,
        },
        { authRole: "student" }
      );

      const nextQuestion = response.data.nextQuestion;

      const answeredSoFar =
        Number(response.data.answered) || current.index;

      setTimeout(() => {
        setAnsweredCount(answeredSoFar);

        if (nextQuestion) {
          setCurrent(nextQuestion);

          setSelected(null);

          setIsSending(false);
        } else {
          finalizeInterview();
        }
      }, 350);
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Could not record the answer. Try again."
      );

      setSelected(null);

      setIsSending(false);
    }
  };

  const progress =
    Math.min(answeredCount / (totalQuestions || 1), 1) * 100;

  const joinLiveInterview = async () => {
    const code = liveCode.trim();

    if (!code) {
      setLiveJoinError("Please enter the room code from your interviewer.");
      return;
    }

    if (code.length !== 6) {
      setLiveJoinError("Room code must be exactly 6 characters.");
      return;
    }

    setJoiningLive(true);
    setLiveJoinError("");

    try {
      const response = await api.post(
        "/api/live/join",
        { code },
        { authRole: "student" }
      );

      navigate(`/live/${response.data.code}`);
    } catch (error) {
      const messageText =
        error.response?.data?.message ||
        "Could not join the live session. Please check the code.";

      setLiveJoinError(messageText);

      toast.error(messageText);
    } finally {
      setJoiningLive(false);
    }
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div style={styles.centerNote}>
          <TypingIndicator />
        </div>
      );
    }

    if (!className) {
      return (
        <div style={styles.startCard}>
          <span style={styles.bigIcon}>🪪</span>

          <h2 style={styles.startTitle}>No class assigned</h2>

          <p style={styles.startText}>
            Your interviewer has not assigned a class to your account yet.
            Please contact them.
          </p>
        </div>
      );
    }

    if (!config.configured) {
      return (
        <div style={styles.startCard}>
          <span style={styles.bigIcon}>📚</span>

          <h2 style={styles.startTitle}>Interview not set up yet</h2>

          <p style={styles.startText}>
            Your interviewer hasn't uploaded the syllabus for{" "}
            <b>{className}</b> yet. Please check back later.
          </p>
        </div>
      );
    }

    if (!config.verified) {
      return (
        <div style={styles.startCard}>
          <span style={styles.bigIcon}>⏳</span>

          <h2 style={styles.startTitle}>Interview not verified yet</h2>

          <p style={styles.startText}>
            Your interviewer hasn't verified the question set for{" "}
            <b>{className}</b> yet. You can start the interview as soon as
            they publish it.
          </p>
        </div>
      );
    }

    if (!started) {
      return (
        <div style={styles.startCard}>
          <span style={styles.bigIcon}>🎓</span>

          <h2 style={styles.startTitle}>{className}</h2>

          <p style={styles.startText}>
            This interview will ask you{" "}
            <b>{config.questionCount} multiple-choice questions</b> from the
            question set verified by your interviewer. Proctoring will
            monitor the session.
          </p>

          {startError && (
            <p style={styles.startError}>{startError}</p>
          )}

          <GradientButton
            onClick={beginInterview}
            style={{ marginTop: 8 }}
          >
            Start Interview
          </GradientButton>
        </div>
      );
    }

    return null;
  };

  const levelStyle = (difficulty) =>
    difficulty === "easy"
      ? styles.levelEasy
      : difficulty === "hard"
      ? styles.levelHard
      : styles.levelMedium;

  return (
    <AnimatedBackground>
      <div style={styles.container}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={styles.header}
        >
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
            {started
              ? `Class: ${className}`
              : "Prepare for your class interview"}
          </p>
        </motion.div>

        {/* Progress */}
        {started && !interviewEnded && (
          <div style={styles.progressRow}>
            <div style={styles.progressWrap}>
              <div style={styles.progressLabel}>
                Answered {Math.min(answeredCount, totalQuestions)}/
                {totalQuestions}
              </div>

              <div style={styles.progressTrack}>
                <motion.div
                  style={styles.progressFill}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Warning Banner */}
        <AnimatePresence>
          {violationCount > 0 && !interviewEnded && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={styles.warningBanner}
            >
              ⚠ Warnings: {violationCount}/3 — Switching tabs, losing focus, or
              attempting screenshots ends the interview.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start / Status screens */}
        {!started && (
          <div style={styles.statusWrap}>{renderBody()}</div>
        )}

        {/* Join a live one-on-one video interview */}
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={styles.liveCard}
          >
            <h3 style={styles.liveTitle}>
              🎥 Live One-on-One Interview
            </h3>

            <p style={styles.liveText}>
              Your interviewer can give you a room code for a live video
              interview. Enter it below to join.
            </p>

            <div style={styles.liveRow}>
              <input
                type="text"
                placeholder="Enter room code"
                maxLength={6}
                value={liveCode}
                onChange={(e) => {
                  setLiveCode(e.target.value.toUpperCase());
                  setLiveJoinError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinLiveInterview();
                }}
                style={styles.liveInput}
              />

              <button
                onClick={joinLiveInterview}
                disabled={joiningLive}
                style={styles.liveBtn}
              >
                {joiningLive ? "Joining..." : "Join"}
              </button>
            </div>

            {liveJoinError && (
              <p style={styles.liveError}>{liveJoinError}</p>
            )}
          </motion.div>
        )}

        {/* Question card */}
        {started && !interviewEnded && current && (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.index}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              style={styles.qCard}
            >
              <div style={styles.qCardHead}>
                <span style={styles.qCounter}>
                  Question {current.index} of{" "}
                  {totalQuestions}
                </span>

                <span
                  style={{
                    ...styles.levelPill,
                    ...levelStyle(current.difficulty),
                  }}
                >
                  {(current.difficulty || "medium").toUpperCase()}
                </span>
              </div>

              <p style={styles.qText}>{current.text}</p>

              <div style={styles.optionsWrap}>
                {current.options.map((option, i) => {
                  const isSelected = selected === i;

                  const locked = selected !== null || isSending;

                  return (
                    <motion.button
                      key={`${current.index}-${i}`}
                      whileHover={
                        locked ? {} : { scale: 1.015, y: -2 }
                      }
                      whileTap={locked ? {} : { scale: 0.985 }}
                      onClick={() => handlePick(i)}
                      disabled={locked}
                      style={{
                        ...styles.optionBtn,
                        ...(isSelected
                          ? styles.optionSelected
                          : {}),
                        ...(locked && !isSelected
                          ? styles.optionLocked
                          : {}),
                      }}
                    >
                      <span
                        style={{
                          ...styles.optionLetter,
                          ...(isSelected
                            ? styles.optionLetterSelected
                            : {}),
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>

                      <span style={styles.optionText}>
                        {option}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {isSending && (
                <div style={styles.sendingRow}>
                  <TypingIndicator />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Ended note */}
        {started && interviewEnded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.endedWrap}
          >
            <p style={styles.endedNote}>
              Interview completed — preparing your results...
            </p>
          </motion.div>
        )}
      </div>
    </AnimatedBackground>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    color: colors.text,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 20px 40px",
    fontFamily: fonts.family,
    userSelect: "none",
    WebkitUserSelect: "none",
  },

  header: {
    textAlign: "center",
    marginBottom: 18,
  },

  title: {
    fontSize: 40,
    fontWeight: 800,
    margin: "0 0 8px",
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    margin: 0,
  },

  statusWrap: {
    width: "100%",
    maxWidth: 640,
  },

  liveCard: {
    width: "100%",
    maxWidth: 640,
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 10,
    padding: "24px 28px",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    boxShadow: shadows.card,
  },

  liveTitle: {
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
    color: colors.text,
  },

  liveText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
  },

  liveRow: {
    display: "flex",
    gap: 10,
    width: "100%",
    maxWidth: 360,
    marginTop: 4,
  },

  liveInput: {
    flex: 1,
    padding: "11px 14px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    outline: "none",
    fontSize: 15,
    textTransform: "uppercase",
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontFamily: fonts.mono,
    letterSpacing: "2px",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },

  liveBtn: {
    padding: "11px 22px",
    borderRadius: radius.md,
    border: "none",
    background: gradients.success,
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(34,197,94,0.3)",
  },

  liveError: {
    color: colors.dangerLight,
    fontSize: 13,
    margin: 0,
  },

  centerNote: {
    display: "flex",
    justifyContent: "center",
    padding: "60px 0",
  },

  startCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 12,
    padding: "46px 34px",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    boxShadow: shadows.card,
  },

  bigIcon: {
    fontSize: 52,
  },

  startTitle: {
    fontSize: 26,
    fontWeight: 800,
    margin: 0,
  },

  startText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 1.6,
    margin: 0,
  },

  startError: {
    color: colors.dangerLight,
    fontSize: 14,
    lineHeight: 1.5,
    margin: 0,
    padding: "10px 14px",
    borderRadius: radius.md,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.4)",
  },

  progressRow: {
    width: "100%",
    maxWidth: 900,
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
  },

  progressWrap: {
    flex: 1,
  },

  progressLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: colors.textMuted,
    marginBottom: 6,
  },

  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    background: gradients.primary,
    boxShadow: "0 0 12px rgba(37,99,235,0.5)",
  },

  warningBanner: {
    width: "100%",
    maxWidth: 900,
    marginBottom: 16,
    padding: "10px 18px",
    borderRadius: radius.md,
    background: "rgba(239,68,68,0.2)",
    border: "1px solid rgba(248,113,113,0.5)",
    color: colors.dangerLight,
    fontSize: 14,
    textAlign: "center",
  },

  qCard: {
    width: "100%",
    maxWidth: 760,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    boxShadow: shadows.card,
    padding: "30px 34px 26px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  qCardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  qCounter: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: 600,
  },

  levelPill: {
    padding: "4px 12px",
    borderRadius: radius.pill,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "1px",
    fontFamily: fonts.mono,
    border: "1px solid transparent",
  },

  levelEasy: {
    background: "rgba(34,197,94,0.12)",
    borderColor: "rgba(74,222,128,0.45)",
    color: "#4ade80",
  },

  levelMedium: {
    background: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.45)",
    color: "#fbbf24",
  },

  levelHard: {
    background: "rgba(248,113,113,0.12)",
    borderColor: "rgba(248,113,113,0.45)",
    color: "#f87171",
  },

  qText: {
    color: colors.text,
    fontSize: 21,
    fontWeight: 600,
    lineHeight: 1.55,
    margin: 0,
  },

  optionsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  optionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    textAlign: "left",
    padding: "15px 18px",
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.05)",
    color: colors.text,
    cursor: "pointer",
    fontFamily: fonts.family,
    transition:
      "background 0.2s, border-color 0.2s, box-shadow 0.2s",
  },

  optionSelected: {
    background: gradients.primary,
    borderColor: "transparent",
    boxShadow: shadows.glow,
  },

  optionLocked: {
    opacity: 0.55,
    cursor: "default",
  },

  optionLetter: {
    minWidth: 34,
    height: 34,
    borderRadius: "50%",
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.08)",
    color: colors.accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: fonts.mono,
    flexShrink: 0,
    transition: "background 0.2s, color 0.2s",
  },

  optionLetterSelected: {
    background: "rgba(255,255,255,0.22)",
    borderColor: "transparent",
    color: "white",
  },

  optionText: {
    fontSize: 15,
    lineHeight: 1.5,
  },

  sendingRow: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 4,
  },

  endedWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
  },

  endedNote: {
    marginTop: 20,
    color: colors.accent,
    fontSize: 16,
    fontWeight: 600,
  },
};

export default Interview;
