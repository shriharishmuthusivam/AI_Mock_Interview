import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import GradientButton from "./GradientButton";
import TextField from "./TextField";
import { colors, fonts, gradients, radius, shadows } from "../styles/theme";

function ConfirmModal({
  open,
  title,
  message,
  icon = "🗑️",
  confirmLabel = "Confirm",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
  inputLabel,
  inputValue,
  onInputChange,
  confirmDisabled = false,
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={styles.backdrop}
          onClick={loading ? undefined : onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            style={styles.panel}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={styles.icon}>{icon}</span>

            <h2 style={styles.title}>{title}</h2>

            {message && <p style={styles.message}>{message}</p>}

            {inputLabel && (
              <TextField
                label={inputLabel}
                type="password"
                icon="🔒"
                placeholder="At least 6 characters"
                value={inputValue || ""}
                onChange={onInputChange}
                style={{ marginTop: 4 }}
              />
            )}

            <div style={styles.actions}>
              <button
                onClick={onCancel}
                disabled={loading}
                style={styles.cancel}
              >
                Cancel
              </button>

              <GradientButton
                onClick={onConfirm}
                loading={loading}
                disabled={confirmDisabled}
                gradient={
                  tone === "danger" ? gradients.danger : gradients.accent
                }
                style={styles.confirm}
              >
                {confirmLabel}
              </GradientButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(2,6,23,0.7)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  },

  panel: {
    width: "100%",
    maxWidth: 400,
    background: "rgba(15,23,42,0.95)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.card,
    padding: "28px 26px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    fontFamily: fonts.family,
  },

  icon: {
    fontSize: 36,
    textAlign: "center",
  },

  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: 800,
    textAlign: "center",
    margin: 0,
  },

  message: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 1.6,
    margin: 0,
  },

  actions: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap",
  },

  cancel: {
    background: "transparent",
    border: `1px solid ${colors.border}`,
    color: colors.textMuted,
    padding: "12px 24px",
    borderRadius: radius.pill,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: fonts.family,
    transition: "border-color 0.2s, color 0.2s",
  },

  confirm: {
    padding: "12px 24px",
  },
};

export default ConfirmModal;
