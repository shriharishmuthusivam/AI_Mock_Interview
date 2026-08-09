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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InterviewerRegister({ setIsInterviewerLoggedIn }) {
  const navigate = useNavigate();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const register = async () => {
    if (username.trim().length < 3) {
      toast.warning("Username must be at least 3 characters");
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      toast.warning("Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      toast.warning("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.warning("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/api/interviewer/register", {
        username,
        email,
        password,
      });

      toast.success(response.data.message);

      setAuth("interviewer", response.data.token, response.data.username);

      setIsInterviewerLoggedIn(true);

      setTimeout(() => navigate("/dashboard"), 400);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") register();
  };

  return (
    <AnimatedBackground>
      <div style={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={styles.backLink}
          onClick={() => navigate("/interviewer-login")}
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
            Interviewer Sign Up
          </h1>

          <p style={styles.subtitle}>
            Create an account to manage students and receive interview reports
            by email.
          </p>

          <TextField
            label="Username"
            placeholder="Enter username"
            icon="👤"
            value={username}
            onChange={setUsername}
          />

          <TextField
            label="Email (for report PDFs)"
            placeholder="Enter email"
            icon="📧"
            value={email}
            onChange={setEmail}
          />

          <TextField
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            icon="🔒"
            value={password}
            onChange={setPassword}
          />

          <TextField
            label="Confirm Password"
            type="password"
            placeholder="Re-enter password"
            icon="🔒"
            value={confirmPassword}
            onChange={setConfirmPassword}
            onKeyDown={handleKeyDown}
          />

          <GradientButton
            onClick={register}
            loading={loading}
            gradient={gradients.accent}
            style={{ width: "100%", marginTop: 6 }}
          >
            {loading ? "Creating..." : "Create Account"}
          </GradientButton>
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
    gap: 16,
  },

  icon: {
    fontSize: 40,
    textAlign: "center",
  },

  title: {
    fontSize: 30,
    fontWeight: 800,
    textAlign: "center",
    margin: 0,
  },

  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 14,
    margin: "0 0 4px",
    lineHeight: 1.5,
  },
};

export default InterviewerRegister;
