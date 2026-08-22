import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { colors, fonts, radius, shadows } from "../styles/theme";

const LIST_MAX_HEIGHT = 260;

function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  emptyLabel,
  style,
  small = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }

    const onPointerDown = (e) => {
      const t = e.target;
      const insideRoot = rootRef.current && rootRef.current.contains(t);
      const insideList = listRef.current && listRef.current.contains(t);
      if (!insideRoot && !insideList) setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    const update = () => {
      const el = rootRef.current;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const estHeight = Math.min(
        LIST_MAX_HEIGHT,
        (options.length + (emptyLabel ? 1 : 0)) * 40 + 12
      );
      const spaceBelow = window.innerHeight - r.bottom - 6;

      const top =
        spaceBelow >= estHeight
          ? r.bottom + 6
          : Math.max(8, r.top - estHeight - 6);

      setPos({
        left: r.left,
        width: r.width,
        top,
        maxHeight: spaceBelow >= estHeight ? undefined : estHeight,
      });
    };

    update();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, options.length, emptyLabel]);

  const selected = value ? options.find((o) => o === value) : "";
  const display = selected || (emptyLabel ? emptyLabel : "");

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          ...(small ? styles.triggerSmall : styles.trigger),
          ...(disabled ? styles.disabled : {}),
        }}
      >
        <span
          style={{
            ...styles.label,
            color: selected || emptyLabel ? colors.text : colors.textMuted,
          }}
        >
          {display || placeholder}
        </span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={styles.chevron}
        >
          ▾
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.ul
              ref={listRef}
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -6 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              style={{
                ...styles.list,
                left: pos.left,
                top: pos.top,
                width: pos.width,
                maxHeight: pos.maxHeight || LIST_MAX_HEIGHT,
              }}
            >
              {emptyLabel && (
                <motion.li
                  key="__empty__"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0 }}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  style={{
                    ...styles.option,
                    ...(!value ? styles.optionSelected : {}),
                  }}
                >
                  {emptyLabel}
                </motion.li>
              )}

              {options.map((o, i) => (
                <motion.li
                  key={o}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (emptyLabel ? 1 : 0) + i * 0.03 }}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  style={{
                    ...styles.option,
                    ...(o === value ? styles.optionSelected : {}),
                  }}
                >
                  {o}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

const styles = {
  trigger: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "14px 16px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxSizing: "border-box",
  },

  triggerSmall: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px 10px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: "#0f172a",
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  },

  disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },

  label: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  chevron: {
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 12,
  },

  list: {
    position: "fixed",
    margin: 0,
    padding: "6px",
    listStyle: "none",
    background: "rgba(15,23,42,0.98)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    boxShadow: shadows.card,
    zIndex: 1000,
    overflowY: "auto",
    fontFamily: fonts.family,
    boxSizing: "border-box",
  },

  option: {
    padding: "10px 12px",
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 14,
    cursor: "pointer",
  },

  optionSelected: {
    background: "rgba(37,99,235,0.2)",
    color: colors.text,
  },
};

export default Dropdown;
