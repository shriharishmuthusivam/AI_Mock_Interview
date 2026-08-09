import React from "react";
import { motion } from "framer-motion";
import { gradients, radius } from "../styles/theme";
import Spinner from "./Spinner";

function GradientButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  gradient = gradients.primary,
  style,
  type = "button",
  ...rest
}) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: "14px 26px",
        borderRadius: radius.pill,
        border: "none",
        background: gradient,
        color: "white",
        fontSize: "16px",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled && !loading ? 0.5 : 1,
        boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        ...style,
      }}
      {...rest}
    >
      {loading && <Spinner size={18} />}
      {children}
    </motion.button>
  );
}

export default GradientButton;
