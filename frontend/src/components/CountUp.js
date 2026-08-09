import React, { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

function CountUp({
  value,
  decimals = 0,
  duration = 1.2,
  style,
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const controls = animate(fromRef.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        fromRef.current = value;
        setDisplay(value);
      },
    });

    return () => controls.stop();
  }, [value, duration]);

  return <span style={style}>{display.toFixed(decimals)}</span>;
}

export default CountUp;
