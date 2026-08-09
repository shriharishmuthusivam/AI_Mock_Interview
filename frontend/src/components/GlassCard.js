import React from "react";
import { motion } from "framer-motion";
import { colors, radius, shadows } from "../styles/theme";

function GlassCard({
  children,
  style,
  whileHover = { y: -6 },
  delay = 0,
  ...rest
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      whileHover={whileHover}
      style={{
        background: colors.surface,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderRadius: radius.lg,
        boxShadow: shadows.card,
        border: `1px solid ${colors.border}`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export default GlassCard;
