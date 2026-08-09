import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import GlassCard from "../components/GlassCard";
import GradientButton from "../components/GradientButton";
import TextField from "../components/TextField";
import { useToast } from "../components/Toast";
import api from "../api";
import { colors, fonts } from "../styles/theme";

function CreateStudent() {
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const createStudent = async () => {
    if (!username || !password) {
      toast.warning("Please enter username and password");
      return;
    }

    if (username.trim().length < 3) {
      toast.warning("Username must be at least 3 characters");
      return;
    }

    if (password.length < 6) {
      toast.warning("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setCreated(false);

    try {
      const response = await api.post(
        "/api/create-student",
        { username, password },
        { authRole: "interviewer" }
      );

      toast.success(response.data.message);

      setUsername("");
      setPassword("");
      setCreated(true);

      setTimeout(() => setCreated(false), 2500);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Error creating student"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") createStudent();
  };

  return (
    <GlassCard style={styles.card}>
      <h1 style={styles.title}>Create Student Account</h1>

      <p style={styles.subtitle}>
        Create login credentials for students to attend AI mock interviews.
      </p>

      <TextField
        label="Student Username"
        placeholder="Enter username"
        icon="👤"
        value={username}
        onChange={setUsername}
        onKeyDown={handleKeyDown}
      />

      <TextField
        label="Student Password"
        type="password"
        placeholder="Enter password"
        icon="🔒"
        value={password}
        onChange={setPassword}
        onKeyDown={handleKeyDown}
      />

      <GradientButton
        onClick={createStudent}
        loading={loading}
        style={{ width: "100%" }}
      >
        {loading ? "Creating..." : "Create Student"}
      </GradientButton>

      <AnimatePresence>
        {created && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={styles.success}
          >
            ✅ Student created successfully
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

const styles = {
  card: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "34px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    margin: 0,
    lineHeight: 1.5,
  },

  success: {
    textAlign: "center",
    color: "#4ade80",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: fonts.family,
    padding: "10px",
    borderRadius: 10,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.35)",
  },
};

export default CreateStudent;
