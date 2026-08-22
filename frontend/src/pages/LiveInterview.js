import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import AnimatedBackground from "../components/AnimatedBackground";
import { useToast } from "../components/Toast";
import api, { TOKEN_KEYS, USER_KEYS, clearAuth } from "../api";
import { colors, fonts, gradients, radius } from "../styles/theme";

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function LiveInterview({ onLogout }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const isInterviewer = !!localStorage.getItem(TOKEN_KEYS.interviewer);
  const role = isInterviewer ? "interviewer" : "student";
  const username =
    localStorage.getItem(USER_KEYS[role]) || "";

  const roomCode = String(code || "").toUpperCase();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [joinedNote, setJoinedNote] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);

  const [showScoreCard, setShowScoreCard] = useState(false);
  const [score, setScore] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roomCode) {
      setError("No room code provided.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get(
          `/api/live/${roomCode}`,
          { authRole: role }
        );

        if (cancelled) return;

        setSession(response.data);

        if (response.data.status === "ended" && !isInterviewer) {
          setError("This live session has ended.");
          setLoading(false);
          return;
        }

        if (role === "student") {
          setTimeout(() => {
            if (!cancelled) setShowVideo(true);
          }, 1200);
        } else if (response.data.studentUsername) {
          setShowVideo(true);
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err.response?.data?.message ||
            "Could not load this live session."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Interviewer: keep checking until the student joins the session
  useEffect(() => {
    if (role !== "interviewer" || !roomCode || showVideo) return;

    const poll = async () => {
      try {
        const response = await api.get(
          `/api/live/${roomCode}`,
          { authRole: "interviewer" }
        );

        if (response.data.studentUsername) {
          setSession(response.data);
          setShowVideo(true);
          setJoinedNote(true);
          setTimeout(() => setJoinedNote(false), 4000);
        }
      } catch (err) {
        console.log(err);
      }
    };

    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [role, roomCode, showVideo]);

  // Timer: count up once video starts
  useEffect(() => {
    if (!showVideo) return;

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showVideo]);

  const handleLogout = () => {
    clearAuth();

    if (onLogout) onLogout();

    navigate("/");
  };

  const handleEnd = async () => {
    setEnding(true);

    try {
      await api.post(
        `/api/live/${roomCode}/end`,
        {},
        { authRole: role }
      );
    } catch (err) {
      console.log(err);
    }

    if (isInterviewer && !session?.score) {
      setShowEndConfirm(false);
      setShowScoreCard(true);
      setEnding(false);
      return;
    }

    setEnding(false);
    navigate("/dashboard");
  };

  const handleSubmitScore = async () => {
    const val = parseFloat(score);

    if (Number.isNaN(val) || val < 0 || val > 10) {
      setScoreError("Please enter a score between 0 and 10.");
      return;
    }

    setSaving(true);
    setScoreError("");

    try {
      await api.post(
        `/api/live/${roomCode}/score`,
        { score: val },
        { authRole: "interviewer" }
      );

      toast.success("Score saved successfully.");
      navigate("/dashboard");
    } catch (err) {
      setScoreError(
        err.response?.data?.message ||
          "Could not save score. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkipScore = () => {
    navigate("/dashboard");
  };

  const handleLeave = () => {
    navigate(isInterviewer ? "/dashboard" : "/interview");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.log(error);
    }
  };

  const roomName = roomCode
    ? `aimock-interview-${roomCode}`
    : "";

  const jitsiUrl = roomName
    ? `https://meet.jit.si/${roomName}#userInfo.displayName=${encodeURIComponent(
        username || (isInterviewer ? "Interviewer" : "Student")
      )}`
    : "";

  return (
    <AnimatedBackground>
      <div style={styles.container}>
        {/* Top nav */}
        <div style={styles.navRow}>
          <button onClick={() => navigate(-1)} style={styles.navBack}>
            ← Back
          </button>

          <button onClick={handleLogout} style={styles.navLogout}>
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
          <h1 style={styles.title}>Live Video Interview</h1>

          <p style={styles.subtitle}>
            One-on-one interview with your{isInterviewer ? " student" : " interviewer"}
          </p>
        </motion.div>

        {loading && (
          <div style={styles.skeletonWrap}>
            <div style={styles.skeletonBar} />
            <div style={{ ...styles.skeletonBar, width: "60%" }} />
            <div style={{ ...styles.skeletonBar, width: "80%", height: 320 }} />
          </div>
        )}

        {error && (
          <div style={styles.startCard}>
            <span style={styles.bigIcon}>📡</span>

            <h2 style={styles.startTitle}>Room unavailable</h2>

            <p style={styles.startText}>{error}</p>

            <button onClick={handleLeave} style={styles.endBtn}>
              Go Back
            </button>
          </div>
        )}

        {/* Score card (interviewer only, after ending) */}
        {showScoreCard && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={styles.scoreCard}
          >
            <span style={styles.bigIcon}>⭐</span>

            <h2 style={styles.startTitle}>Rate the student</h2>

            <p style={styles.startText}>
              How did <b>{session?.studentUsername || "the student"}</b> perform
              in this interview?
            </p>

            <div style={styles.scoreInputRow}>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                placeholder="0 – 10"
                value={score}
                onChange={(e) => {
                  setScore(e.target.value);
                  setScoreError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitScore();
                }}
                style={styles.scoreInput}
              />

              <span style={styles.scoreMax}>/ 10</span>
            </div>

            {scoreError && (
              <p style={styles.scoreError}>{scoreError}</p>
            )}

            <div style={styles.scoreActions}>
              <button
                onClick={handleSkipScore}
                disabled={saving}
                style={styles.skipBtn}
              >
                Skip
              </button>

              <button
                onClick={handleSubmitScore}
                disabled={saving}
                style={styles.saveScoreBtn}
              >
                {saving ? "Saving..." : "Save Score"}
              </button>
            </div>
          </motion.div>
        )}

        {!loading && !error && !showScoreCard && !showVideo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={styles.waitingCard}
          >
            {isInterviewer ? (
              <>
                <span style={styles.bigIcon}>🕒</span>

                <h2 style={styles.startTitle}>
                  Waiting for the student
                </h2>

                <p style={styles.startText}>
                  Share this room code with the student so they can join
                  your interview.
                </p>

                <span style={styles.waitingCode}>{roomCode}</span>

                <button onClick={handleCopy} style={styles.waitingCopy}>
                  {copied ? "Copied ✓" : "Copy Code"}
                </button>

                <motion.p
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={styles.waitingText}
                >
                  <span style={styles.pulseDot} />
                  Waiting for the student to join...
                </motion.p>
              </>
            ) : (
              <>
                <span style={styles.bigIcon}>🎥</span>

                <h2 style={styles.startTitle}>Connecting to room</h2>

                <p style={styles.startText}>
                  Joining the live interview room with your interviewer...
                </p>

                <motion.p
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={styles.waitingText}
                >
                  <span style={styles.pulseDot} />
                  Connecting...
                </motion.p>
              </>
            )}
          </motion.div>
        )}

        {!loading && !error && !showScoreCard && showVideo && (
          <>
            {/* Joined note */}
            {joinedNote && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={styles.joinedBanner}
              >
                The student joined the room — starting the video call.
              </motion.div>
            )}

            {/* Room code bar + timer */}
            <div style={styles.codeBar}>
              <span style={styles.codeLabel}>Room Code</span>

              <span style={styles.codeValue}>{roomCode}</span>

              <button onClick={handleCopy} style={styles.copyBtn}>
                {copied ? "Copied ✓" : "Copy"}
              </button>

              <span style={styles.timer}>{formatElapsed(elapsed)}</span>

              {isInterviewer && (
                <span style={styles.sessionTag}>
                  {session?.className || "General"}
                </span>
              )}
            </div>

            {/* Jitsi video call */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={styles.videoWrap}
            >
              <iframe
                title={`Live Interview ${roomCode}`}
                src={jitsiUrl}
                allow="camera; microphone; display-capture; fullscreen"
                allowFullScreen
                style={styles.videoFrame}
              />
            </motion.div>

            {/* Actions */}
            <div style={styles.actions}>
              <button onClick={handleLeave} style={styles.backBtn}>
                Leave Room
              </button>

              <button
                onClick={() => setShowEndConfirm(true)}
                style={styles.endBtn}
              >
                End Session
              </button>
            </div>
          </>
        )}

        {/* End confirmation modal */}
        <AnimatePresence>
          {showEndConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={styles.overlay}
              onClick={() => !ending && setShowEndConfirm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                style={styles.modal}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={styles.modalTitle}>End this session?</h3>

                <p style={styles.modalText}>
                  The video call will be disconnected for both participants.
                  {isInterviewer && " You will be asked to rate the student next."}
                </p>

                <div style={styles.modalActions}>
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    disabled={ending}
                    style={styles.modalCancel}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleEnd}
                    disabled={ending}
                    style={styles.modalConfirm}
                  >
                    {ending ? "Ending..." : "End Session"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
  },

  navRow: {
    width: "100%",
    maxWidth: 960,
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
    marginBottom: 16,
  },

  title: {
    fontSize: 34,
    fontWeight: 800,
    margin: "0 0 6px",
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    margin: 0,
  },

  centerNote: {
    color: colors.textMuted,
    fontSize: 15,
    padding: "60px 0",
  },

  skeletonWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 960,
    padding: "40px 0",
  },

  skeletonBar: {
    width: "40%",
    height: 22,
    borderRadius: radius.md,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04))",
    backgroundSize: "200% 100%",
    animation: "skeletonShimmer 1.2s linear infinite",
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
    maxWidth: 480,
  },

  waitingCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 12,
    padding: "46px 40px",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    maxWidth: 480,
    width: "100%",
  },

  bigIcon: {
    fontSize: 52,
  },

  startTitle: {
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
  },

  startText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 1.6,
    margin: 0,
  },

  waitingCode: {
    fontFamily: fonts.mono,
    fontSize: 44,
    fontWeight: 700,
    letterSpacing: "8px",
    color: colors.accent,
    padding: "8px 20px",
    borderRadius: radius.lg,
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${colors.border}`,
    marginTop: 6,
  },

  waitingCopy: {
    padding: "10px 26px",
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

  waitingText: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: 600,
    margin: "6px 0 0",
  },

  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: colors.accent,
    boxShadow: `0 0 12px ${colors.accent}`,
  },

  joinedBanner: {
    width: "100%",
    maxWidth: 960,
    marginBottom: 16,
    padding: "10px 18px",
    borderRadius: radius.md,
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.4)",
    color: "#4ade80",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center",
  },

  codeBar: {
    width: "100%",
    maxWidth: 960,
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    padding: "10px 16px",
    borderRadius: radius.md,
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${colors.border}`,
    flexWrap: "wrap",
  },

  codeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: 600,
  },

  codeValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "3px",
    color: colors.accent,
  },

  copyBtn: {
    padding: "6px 14px",
    borderRadius: radius.pill,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  sessionTag: {
    padding: "5px 12px",
    borderRadius: radius.pill,
    background: "rgba(124,58,237,0.15)",
    color: "#c084fc",
    fontSize: 13,
    fontWeight: 600,
  },

  timer: {
    marginLeft: "auto",
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: 700,
    color: colors.textMuted,
    padding: "4px 12px",
    borderRadius: radius.pill,
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${colors.border}`,
  },

  videoWrap: {
    width: "100%",
    maxWidth: 960,
    aspectRatio: "16 / 10",
    borderRadius: radius.lg,
    overflow: "hidden",
    border: `1px solid ${colors.border}`,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    background: "#0b1120",
  },

  videoFrame: {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block",
  },

  actions: {
    display: "flex",
    gap: 12,
    marginTop: 18,
  },

  backBtn: {
    padding: "11px 26px",
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

  endBtn: {
    padding: "11px 26px",
    borderRadius: radius.pill,
    border: "none",
    background: gradients.danger,
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(239,68,68,0.35)",
  },

  scoreCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 14,
    padding: "46px 40px",
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    maxWidth: 480,
    width: "100%",
  },

  scoreInputRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },

  scoreInput: {
    width: 100,
    padding: "12px 14px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: 700,
    textAlign: "center",
    outline: "none",
  },

  scoreMax: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: 600,
  },

  scoreError: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: 600,
    margin: 0,
  },

  scoreActions: {
    display: "flex",
    gap: 12,
    marginTop: 4,
  },

  skipBtn: {
    padding: "11px 26px",
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

  saveScoreBtn: {
    padding: "11px 26px",
    borderRadius: radius.pill,
    border: "none",
    background: gradients.success,
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(34,197,94,0.35)",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },

  modal: {
    background: "#0f172a",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    padding: "32px 30px",
    maxWidth: 420,
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    margin: "0 0 10px",
    color: colors.text,
  },

  modalText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.6,
    margin: "0 0 22px",
  },

  modalActions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
  },

  modalCancel: {
    padding: "10px 22px",
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

  modalConfirm: {
    padding: "10px 22px",
    borderRadius: radius.pill,
    border: "none",
    background: gradients.danger,
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(239,68,68,0.35)",
  },
};

export default LiveInterview;
