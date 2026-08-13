import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";

import AnimatedBackground from "../components/AnimatedBackground";
import api, { TOKEN_KEYS, USER_KEYS, clearAuth } from "../api";
import { colors, fonts, gradients, radius } from "../styles/theme";

function LiveInterview({ onLogout }) {
  const { code } = useParams();
  const navigate = useNavigate();

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

  const handleLogout = () => {
    clearAuth();

    if (onLogout) onLogout();

    navigate("/");
  };

  const handleEnd = async () => {
    try {
      await api.post(
        `/api/live/${roomCode}/end`,
        {},
        { authRole: role }
      );
    } catch (error) {
      console.log(error);
    }

    navigate(isInterviewer ? "/dashboard" : "/interview");
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
            One-on-one interview with your interviewer
          </p>
        </motion.div>

        {loading && (
          <div style={styles.centerNote}>Loading room...</div>
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

        {!loading && !error && !showVideo && (
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

        {!loading && !error && showVideo && (
          <>
            {/* Joined note */}
            {joinedNote && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={styles.joinedBanner}
              >
                🎉 The student joined the room — starting the video call.
              </motion.div>
            )}

            {/* Room code bar */}
            <div style={styles.codeBar}>
              <span style={styles.codeLabel}>Room Code</span>

              <span style={styles.codeValue}>{roomCode}</span>

              <button onClick={handleCopy} style={styles.copyBtn}>
                {copied ? "Copied ✓" : "Copy"}
              </button>

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

              <button onClick={handleEnd} style={styles.endBtn}>
                End Session
              </button>
            </div>
          </>
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
    marginLeft: "auto",
    padding: "5px 12px",
    borderRadius: radius.pill,
    background: "rgba(124,58,237,0.15)",
    color: "#c084fc",
    fontSize: 13,
    fontWeight: 600,
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
};

export default LiveInterview;
