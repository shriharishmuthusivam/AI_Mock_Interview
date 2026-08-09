import React, { useState } from "react";
import { colors, radius, fonts } from "../styles/theme";

function TextField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  style,
  ...rest
}) {
  const [show, setShow] = useState(false);

  const isPassword = type === "password";

  const inputType =
    isPassword && show ? "text" : type;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      {label && (
        <label style={styles.label}>{label}</label>
      )}

      <div style={styles.field}>
        {icon && <span style={styles.icon}>{icon}</span>}

        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            ...styles.input,
            paddingLeft: icon ? 44 : 16,
            paddingRight: isPassword ? 52 : 16,
          }}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            style={styles.eye}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "🙈" : "👁"}
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.family,
  },

  field: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  icon: {
    position: "absolute",
    left: 14,
    fontSize: 17,
    pointerEvents: "none",
  },

  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.family,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  },

  eye: {
    position: "absolute",
    right: 8,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: 8,
  },
};

export default TextField;
