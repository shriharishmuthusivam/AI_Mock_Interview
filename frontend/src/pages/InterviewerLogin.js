import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import AnimatedBackground from "../components/AnimatedBackground";
import GlassCard from "../components/GlassCard";
import GradientButton from "../components/GradientButton";
import TextField from "../components/TextField";
import { useToast } from "../components/Toast";
import { setAuth } from "../api";
import api from "../api";
import { colors, fonts, gradients } from "../styles/theme";

function InterviewerLogin({ setIsInterviewerLoggedIn }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const loginInterviewer = async () => {
    if (!username || !password) {
      toast.warning("Please enter username and password");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/api/interviewer-login", {
        username,
        password,
      });

      toast.success(response.data.message);

      setAuth("interviewer", response.data.token, response.data.username);

      setIsInterviewerLoggedIn(true);

      setTimeout(() => navigate("/dashboard"), 400);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") loginInterviewer();
  };

  return (
    <AnimatedBackground>
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

        <GlassCard style={styles.card}>
          <div style={styles.icon}>📋</div>

          <h1
            style={{
              ...styles.title,
              background: gradients.accent,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Interviewer Login
          </h1>

          <p style={styles.subtitle}>
            Manage students and view interview analytics
          </p>

          <TextField
            label="Username"
            placeholder="Enter username"
            icon="👤"
            value={username}
            onChange={setUsername}
            onKeyDown={handleKeyDown}
          />

          <TextField
            label="Password"
            type="password"
            placeholder="Enter password"
            icon="🔒"
            value={password}
            onChange={setPassword}
            onKeyDown={handleKeyDown}
          />

          <GradientButton
            onClick={loginInterviewer}
            loading={loading}
            gradient={gradients.accent}
            style={{ width: "100%", marginTop: 6 }}
          >
            {loading ? "Logging in..." : "Login"}
          </GradientButton>

          <p style={styles.registerHint}>
            Interviewer accounts are created by your college administrator.
          </p>
        </GlassCard>
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
    maxWidth: 420,
    padding: "40px 36px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  icon: {
    fontSize: 40,
    textAlign: "center",
  },

  title: {
    fontSize: 32,
    fontWeight: 800,
    textAlign: "center",
    margin: 0,
  },

  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 15,
    margin: "0 0 6px",
    lineHeight: 1.5,
  },

  registerHint: {
    margin: 0,
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 1.5,
  },
};

export default InterviewerLogin;
