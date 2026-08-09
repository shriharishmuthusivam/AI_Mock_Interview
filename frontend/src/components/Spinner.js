import React from "react";

function Spinner({ size = 20, color = "white", style }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid rgba(255,255,255,0.25)`,
        borderTopColor: color,
        animation: "spin 0.7s linear infinite",
        ...style,
      }}
    />
  );
}

export default Spinner;
