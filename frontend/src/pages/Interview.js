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
  onLogout,
}) {
  const navigate = useNavigate();

  const toast = useToast();

  const [message, setMessage] = useState("");

  const [chat, setChat] = useState([]);

  const [questionCount, setQuestionCount] = useState(0);

  const [interviewEnded, setInterviewEnded] =
    useState(false);

  const [isSending, setIsSending] =
    useState(false);

  const [score, setScore] = useState(0);

  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState({
    configured: false,
    questionCount: 0,
  });

  const [className, setClassName] = useState("");

  const [started, setStarted] = useState(false);

  const [startError, setStartError] = useState("");

  const [liveCode, setLiveCode] = useState("");

  const [joiningLive, setJoiningLive] = useState(false);

  const [liveJoinError, setLiveJoinError] = useState("");

  const totalMarksRef = useRef(0);

  const chatBoxRef = useRef(null);

  const sessionIdRef = useRef("");

  const currentQuestionRef = useRef("");

  const startedRef = useRef(false);

  const {
    violationCount,
    startProctoring,
    stopProctoring,
  } = useProctoring({
    maxWarnings: 3,

    onViolation: (reason, count, max) => {
      setChat((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `WARNING (${count}/${max}): ${reason}\n\nFurther violations will end the interview automatically.`,
        },
      ]);
    },

    onLimitReached: () => {
      setInterviewEnded(true);

      stopProctoring();

      setTotalScore(totalMarksRef.current);

      sendReport();

      setTimeout(() => {
        setMaxScore(config.questionCount * 10);

        setShowResult(true);
      }, 2000);
    },
  });

  // Load the student's class interview config
  useEffect(() => {
    const cls = getStudentClass();

    if (!cls) {
      setLoading(false);
      setConfig({ configured: false, questionCount: 0 });
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
        setConfig({ configured: false, questionCount: 0 });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Auto-scroll chat to the newest message
  useEffect(() => {
    const node = chatBoxRef.current;

    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [chat, isSending]);

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

  // Build conversation history for the AI (excludes warnings / errors)
  const buildTranscript = () =>
    chat
      .filter(
        (msg) =>
          !msg.text.startsWith("WARNING") &&
          !msg.text.startsWith("Backend not connected")
      )
      .map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

  // Extract the next question from an AI reply
  const parseNextQuestion = (reply) => {
    const match = reply.match(/Next Question:\s*([\s\S]+)$/i);

    if (match && match[1].trim()) {
      currentQuestionRef.current = match[1].trim();
    }
  };

  // Start Interview (get the AI to generate the first question)
  const beginInterview = async () => {
    if (startedRef.current) return;

    startedRef.current = true;

    setStartError("");

    sessionIdRef.current =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setInterviewEnded(false);

    totalMarksRef.current = 0;

    setScore(0);

    setChat([
      {
        sender: "ai",
        text: `Welcome to the ${className} Mock Interview.\n\nAnswer ${config.questionCount} questions based on your class syllabus. Let's begin.`,
      },
    ]);

    setStarted(true);

    startProctoring();

    try {
      const response = await api.post(
        "/api/chat",
        {
          message: "Begin the interview.",
          sessionId: sessionIdRef.current,
          transcript: [],
          start: true,
          questionCount: config.questionCount,
          questionIndex: 0,
        },
        { authRole: "student" }
      );

      const firstQuestion = response.data.reply;

      currentQuestionRef.current = firstQuestion;

      setQuestionCount(1);

      setChat([
        {
          sender: "ai",
          text: `Welcome to the ${className} Mock Interview.\n\nAnswer ${config.questionCount} questions based on your class syllabus.\n\nFirst question:\n\n${firstQuestion}`,
        },
      ]);
    } catch (error) {
      console.error(error);

      startedRef.current = false;

      setStarted(false);

      setStartError(
        error.response?.data?.message ||
          "Could not start the interview. Please check that the backend and AI service are reachable, then try again."
      );

      stopProctoring();
    }
  };

  // Send Message
  const sendMessage = async () => {
    if (!message.trim()) return;

    if (interviewEnded) return;

    if (isSending) return;

    const userMessage = {
      sender: "user",
      text: message,
    };

    setChat((prev) => [...prev, userMessage]);

    setIsSending(true);

    try {
      const response = await api.post(
        "/api/chat",
        {
          message,
          sessionId: sessionIdRef.current,
          question: currentQuestionRef.current,
          violationCount,
          transcript: buildTranscript(),
          questionCount: config.questionCount,
          questionIndex: questionCount,
        },
        { authRole: "student" }
      );

      let aiReply = response.data.reply;

      const nextCount = questionCount + 1;

      // Remember the next question the AI asks for the report
      parseNextQuestion(aiReply);

      // Remove next question only after the LAST question has been answered
      if (nextCount > config.questionCount) {
        aiReply = aiReply.replace(/Next Question:.*/is, "");
      }

      const answerScore = Number(response.data.score) || 0;

      totalMarksRef.current += answerScore;

      setScore(totalMarksRef.current);

      const aiMessage = {
        sender: "ai",
        text: aiReply,
      };

      setQuestionCount(nextCount);

      // Interview ends after the last configured question is answered
      if (nextCount > config.questionCount) {
        setInterviewEnded(true);

        stopProctoring();

        sendReport();

        setTimeout(() => {
          setTotalScore(totalMarksRef.current);

          setMaxScore(config.questionCount * 10);

          setShowResult(true);
        }, 2000);

        setChat((prev) => [
          ...prev,
          aiMessage,
          {
            sender: "ai",
            text: "Interview Completed Successfully.\n\nThank you for attending the AI Mock Interview.",
          },
        ]);
      } else {
        setChat((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error(error);

      const status = error.response?.status;

      // If the FINAL answer hits a rate limit, still finish the interview
      // so the student gets their results instead of being stuck.
      if (status === 429 && questionCount >= config.questionCount) {
        setInterviewEnded(true);

        stopProctoring();

        sendReport();

        setChat((prev) => [
          ...prev,
          {
            sender: "ai",
            text: "The final answer could not be processed because the AI service was temporarily rate-limited, but your results are ready.",
          },
        ]);

        setTimeout(() => {
          setTotalScore(totalMarksRef.current);

          setMaxScore(config.questionCount * 10);

          setShowResult(true);
        }, 2000);

        return;
      }

      const errorMessage = {
        sender: "ai",
        text:
          error.response?.data?.message ||
          "Backend not connected yet.",
      };

      setChat((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }

    setMessage("");
  };

  const progress =
    Math.min(questionCount / (config.questionCount || 1), 1) * 100;

  const joinLiveInterview = async () => {
    const code = liveCode.trim();

    if (!code) {
      setLiveJoinError("Please enter the room code from your interviewer.");
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

    if (!started) {
      return (
        <div style={styles.startCard}>
          <span style={styles.bigIcon}>🎓</span>

          <h2 style={styles.startTitle}>{className}</h2>

          <p style={styles.startText}>
            This interview will ask you{" "}
            <b>{config.questionCount} questions</b> generated from your class
            syllabus. Proctoring will monitor the session.
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

  return (
    <AnimatedBackground>
      <div style={styles.container}>
        {/* Top nav */}
        <div style={styles.navRow}>
          <button
            onClick={() => navigate(-1)}
            style={styles.navBack}
          >
            ← Back
          </button>

          <button onClick={onLogout} style={styles.navLogout}>
            Logout
          </button>
        </div>

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

        {/* Progress + Score */}
        {started && !interviewEnded && (
          <div style={styles.progressRow}>
            <div style={styles.progressWrap}>
              <div style={styles.progressLabel}>
                Question{" "}
                {Math.min(questionCount, config.questionCount)}/
                {config.questionCount}
              </div>

              <div style={styles.progressTrack}>
                <motion.div
                  style={styles.progressFill}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            <div style={styles.scorePill}>
              <span style={styles.scoreLabel}>Score</span>
              <span style={styles.scoreValue}>{score}</span>
            </div>
          </div>
        )}

        {/* Warning Banner */}
        <AnimatePresence>
          {violationCount > 0 && (
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
                value={liveCode}
                onChange={(e) =>
                  setLiveCode(e.target.value.toUpperCase())
                }
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

        {/* Chat Box */}
        {started && (
          <div style={styles.chatBox} ref={chatBoxRef}>
            {chat.map((msg, index) => (
              <motion.div
                key={`${index}-${msg.sender}`}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                  ...styles.message,
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  flexDirection: msg.sender === "user" ? "row-reverse" : "row",
                }}
              >
                <span style={styles.avatar}>
                  {msg.sender === "user" ? "🙂" : "🤖"}
                </span>

                <span
                  style={{
                    ...styles.bubble,
                    background:
                      msg.sender === "user"
                        ? gradients.primary
                        : "#1e293b",
                  }}
                >
                  {msg.text}
                </span>
              </motion.div>
            ))}

            {isSending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ ...styles.message, alignSelf: "flex-start" }}
              >
                <span style={styles.avatar}>🤖</span>
                <TypingIndicator />
              </motion.div>
            )}
          </div>
        )}

        {/* Input Area */}
        {started && !interviewEnded && (
          <div style={styles.inputContainer}>
            <input
              type="text"
              placeholder="Type your answer..."
              autoComplete="off"
              autoCorrect="off"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              style={styles.input}
              disabled={isSending}
            />

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={sendMessage}
              style={styles.sendButton}
              disabled={isSending}
            >
              Send ➤
            </motion.button>
          </div>
        )}

        {/* Ended note */}
        {started && interviewEnded && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.endedNote}
          >
            Interview completed — preparing your results...
          </motion.p>
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

  navRow: {
    width: "100%",
    maxWidth: 900,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  navBack: {
    padding: "9px 18px",
    borderRadius: radius.pill,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  navLogout: {
    padding: "9px 18px",
    borderRadius: radius.pill,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(239,68,68,0.12)",
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s",
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

  scorePill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: radius.pill,
    background: "rgba(34,211,238,0.1)",
    border: "1px solid rgba(34,211,238,0.3)",
  },

  scoreLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },

  scoreValue: {
    fontFamily: fonts.mono,
    color: colors.accent,
    fontSize: 18,
    fontWeight: 700,
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

  chatBox: {
    width: "100%",
    maxWidth: 900,
    height: 480,
    background: "rgba(255,255,255,0.04)",
    borderRadius: radius.lg,
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.card,
  },

  message: {
    display: "flex",
    gap: 10,
    maxWidth: "82%",
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  },

  bubble: {
    padding: "12px 16px",
    borderRadius: 16,
    background: "#1e293b",
    color: colors.text,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    fontSize: 15,
  },

  inputContainer: {
    width: "100%",
    maxWidth: 900,
    display: "flex",
    gap: 10,
    marginTop: 18,
  },

  input: {
    flex: 1,
    padding: "15px 18px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    outline: "none",
    fontSize: 16,
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontFamily: fonts.family,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },

  sendButton: {
    padding: "15px 26px",
    borderRadius: radius.md,
    border: "none",
    background: gradients.primary,
    color: "white",
    fontSize: 16,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: shadows.glow,
  },

  endedNote: {
    marginTop: 20,
    color: colors.accent,
    fontSize: 16,
    fontWeight: 600,
  },
};

export default Interview;
