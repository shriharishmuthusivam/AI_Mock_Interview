import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { colors, radius } from "../styles/theme";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  success: "✓",
  error: "✕",
  info: "i",
  warning: "!",
};

const tints = {
  success: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.5)", icon: "#4ade80" },
  error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)", icon: "#f87171" },
  info: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.5)", icon: "#60a5fa" },
  warning: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.5)", icon: "#fbbf24" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "info", duration = 3500) => {
      const id = `${Date.now()}-${Math.random()}`;

      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const toast = {
    success: (m) => showToast(m, "success"),
    error: (m) => showToast(m, "error"),
    info: (m) => showToast(m, "info"),
    warning: (m) => showToast(m, "warning"),
    show: showToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div style={styles.container}>
        <AnimatePresence>
          {toasts.map((t) => {
            const tint = tints[t.type];

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onClick={() => dismiss(t.id)}
                style={{
                  ...styles.toast,
                  background: tint.bg,
                  border: `1px solid ${tint.border}`,
                }}
              >
                <span
                  style={{
                    ...styles.icon,
                    color: tint.icon,
                    borderColor: tint.icon,
                  }}
                >
                  {icons[t.type]}
                </span>

                <span style={styles.message}>{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 24,
    right: 24,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    pointerEvents: "none",
  },

  toast: {
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 18px",
    borderRadius: radius.md,
    backdropFilter: "blur(12px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
    maxWidth: 340,
    cursor: "pointer",
  },

  icon: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },

  message: {
    color: colors.text,
    fontSize: 14,
    fontFamily: "inherit",
    lineHeight: 1.4,
  },
};
