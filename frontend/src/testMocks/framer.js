import React from "react";

const Passthrough = ({ children }) => children;

export const AnimatePresence = ({ children }) => children;

export const motion = {
  div: Passthrough,
  p: Passthrough,
  span: Passthrough,
  h2: Passthrough,
  button: Passthrough,
  circle: Passthrough,
  tr: Passthrough,
};

export const animate = () => ({
  stop: () => {},
});
