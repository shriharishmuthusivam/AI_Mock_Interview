import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

import useProctoring from "../hooks/useProctoring";
import AnimatedBackground from "../components/AnimatedBackground";
import TypingIndicator from "../components/TypingIndicator";
import api from "../api";
import { colors, fonts, gradients, radius, shadows } from "../styles/theme";

const SUBJECTS = [
  { name: "DBMS", icon: "🗄", tag: "Databases" },
  { name: "OOPs", icon: "🧱", tag: "Object Oriented" },
  { name: "DSA", icon: "🧠", tag: "Algorithms" },
  { name: "Operating Systems", icon: "⚙️", tag: "OS Concepts" },
  { name: "Computer Networks", icon: "🌐", tag: "Networking" },
];

function Interview({
  student,
  setShowResult,
  setTotalScore,
}) {
  const [message, setMessage] = useState("");

  const [selectedSubject, setSelectedSubject] =
    useState("");

  const [chat, setChat] = useState([]);

  const [questionCount, setQuestionCount] =
    useState(0);

  const [interviewEnded, setInterviewEnded] =
    useState(false);

  const [isSending, setIsSending] =
    useState(false);

  const [score, setScore] = useState(0);

  const MAX_QUESTIONS = 10;

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
        setShowResult(true);
      }, 2000);
    },
  });

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

  // Start Interview
  const beginInterview = (subject) => {
    if (startedRef.current) return;

    startedRef.current = true;

    sessionIdRef.current =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    currentQuestionRef.current = `Tell me what you know about ${subject}.`;

    setSelectedSubject(subject);

    setQuestionCount(1);

    setInterviewEnded(false);

    totalMarksRef.current = 0;

    setScore(0);

    setChat([
      {
        sender: "ai",
        text: `Welcome to the ${subject} Mock Interview.\n\nLet's begin.\n\nTell me what you know about ${subject}.`,
      },
    ]);

    startProctoring();
  };

  // Send Message
  const sendMessage = async () => {
    if (!message.trim()) return;

    if (interviewEnded) return;

    if (isSending) return;

    if (!selectedSubject) {
      const notice = {
        sender: "ai",
        text: "Please select a subject to start the interview.",
      };

      setChat((prev) => [...prev, notice]);

      return;
    }

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
          subject: selectedSubject,
          sessionId: sessionIdRef.current,
          question: currentQuestionRef.current,
          violationCount,
          transcript: buildTranscript(),
        },
        { authRole: "student" }
      );

      let aiReply = response.data.reply;

      const nextCount = questionCount + 1;

      // Remember the next question the AI asks for the report
      parseNextQuestion(aiReply);

      // Remove next question after final question
      if (nextCount >= MAX_QUESTIONS) {
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

      // Final Question
      if (nextCount >= MAX_QUESTIONS) {
        setInterviewEnded(true);

        stopProctoring();

        sendReport();

        setTimeout(() => {
          setTotalScore(totalMarksRef.current);

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

      const errorMessage = {
        sender: "ai",
        text: "Backend not connected yet.",
      };

      setChat((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }

    setMessage("");
  };

  const progress =
    Math.min(questionCount / MAX_QUESTIONS, 1) * 100;

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
            {selectedSubject
              ? `Subject: ${selectedSubject}`
              : "Select a subject to begin"}
          </p>
        </motion.div>

        {/* Progress + Score */}
        {selectedSubject && !interviewEnded && (
          <div style={styles.progressRow}>
            <div style={styles.progressWrap}>
              <div style={styles.progressLabel}>
                Question {Math.min(questionCount, MAX_QUESTIONS)}/{MAX_QUESTIONS}
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

        {/* Subject Picker */}
        {!selectedSubject && (
          <div style={styles.subjectContainer}>
            {SUBJECTS.map((s, i) => (
              <motion.button
                key={s.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                whileHover={{ y: -6, scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => beginInterview(s.name)}
                style={styles.subjectButton}
              >
                <span style={styles.subjectIcon}>{s.icon}</span>
                <span style={styles.subjectName}>{s.name}</span>
                <span style={styles.subjectTag}>{s.tag}</span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Chat Box */}
        {selectedSubject && (
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
        {selectedSubject && !interviewEnded && (
          <div style={styles.inputContainer}>
            <input
              type="text"
              placeholder="Type your answer..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              style={styles.input}
              disabled={!selectedSubject || isSending}
            />

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={sendMessage}
              style={styles.sendButton}
              disabled={!selectedSubject || isSending}
            >
              Send ➤
            </motion.button>
          </div>
        )}

        {/* Ended note */}
        {selectedSubject && interviewEnded && (
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

  subjectContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    width: "100%",
    maxWidth: 900,
    margin: "20px 0",
  },

  subjectButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "26px 18px",
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.05)",
    color: colors.text,
    cursor: "pointer",
    fontFamily: fonts.family,
    transition: "border-color 0.25s, box-shadow 0.25s",
  },

  subjectIcon: {
    fontSize: 34,
  },

  subjectName: {
    fontSize: 16,
    fontWeight: 700,
  },

  subjectTag: {
    fontSize: 12,
    color: colors.textMuted,
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
