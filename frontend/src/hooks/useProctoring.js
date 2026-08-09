import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MAX_WARNINGS = 3;

function useProctoring({
  maxWarnings = DEFAULT_MAX_WARNINGS,
  onViolation,
  onLimitReached,
}) {
  const [violationCount, setViolationCount] =
    useState(0);

  const [active, setActive] = useState(false);

  const [warning, setWarning] = useState("");

  const handlersRef = useRef({});

  const activeRef = useRef(false);

  const violationRef = useRef(0);

  const lastViolationRef = useRef(0);

  const graceUntilRef = useRef(0);

  const onViolationRef = useRef(onViolation);

  const onLimitReachedRef =
    useRef(onLimitReached);

  const devtoolsIntervalRef = useRef(null);

  useEffect(() => {
    onViolationRef.current = onViolation;

    onLimitReachedRef.current =
      onLimitReached;
  });

  //
  // Violations
  //
  const countViolation = useCallback(
    (reason) => {
      const now = Date.now();

      // Ignore bursts caused by dialogs / startup
      if (now < graceUntilRef.current)
        return;

      if (
        now - lastViolationRef.current <
        800
      )
        return;

      lastViolationRef.current = now;

      violationRef.current += 1;

      setViolationCount(
        violationRef.current
      );

      setWarning(reason);

      onViolationRef.current?.(
        reason,
        violationRef.current,
        maxWarnings
      );

      if (
        violationRef.current >=
        maxWarnings
      ) {
        onLimitReachedRef.current?.();
      }
    },
    [maxWarnings]
  );

  //
  // Fullscreen
  //
  const enterFullscreen =
    useCallback(() => {
      const el =
        document.documentElement;

      if (
        !document.fullscreenElement &&
        el.requestFullscreen
      ) {
        el.requestFullscreen().catch(
          () => {}
        );
      }
    }, []);

  const exitFullscreen =
    useCallback(() => {
      if (
        document.fullscreenElement &&
        document.exitFullscreen
      ) {
        document.exitFullscreen().catch(
          () => {}
        );
      }
    }, []);

  //
  // Start / Stop
  //
  const startProctoring =
    useCallback(() => {
      setActive(true);

      activeRef.current = true;

      violationRef.current = 0;

      setViolationCount(0);

      setWarning("");

      // Small grace period so the fullscreen
      // transition doesn't count as a violation
      graceUntilRef.current =
        Date.now() + 3000;

      const onVisibility = () => {
        if (document.hidden) {
          countViolation(
            "Tab switching detected. This counts as a warning."
          );
        }
      };

      const onBlur = () => {
        // Hidden state is handled above; this
        // catches alt-tab / window loses focus
        if (document.hidden) return;

        countViolation(
          "Window lost focus. This counts as a warning."
        );
      };

      const onFullscreenChange =
        () => {
          if (
            !document.fullscreenElement
          ) {
            countViolation(
              "Exited fullscreen. This counts as a warning."
            );

            enterFullscreen();
          }
        };

      const onKeyDown = (e) => {
        const key = (e.key || "")
          .toUpperCase();

        const blocked =
          key === "F12" ||
          key === "PRINTSCREEN" ||
          key === "F5" ||
          key === "F4" ||
          key === "PAGEUP" ||
          key === "PAGEDOWN" ||
          (e.ctrlKey &&
            e.shiftKey &&
            ["I", "J", "C", "S"].includes(
              key
            )) ||
          (e.ctrlKey &&
            ["U", "P", "S", "R", "V", "W", "F4", "F5"].includes(
              key
            )) ||
          (e.altKey && key === "F4");

        if (blocked) {
          e.preventDefault();

          countViolation(
            "Blocked a prohibited shortcut."
          );
        }
      };

      const onContextMenu = (e) => {
        e.preventDefault();
      };

      const onCopy = (e) => {
        e.preventDefault();
      };

      const onCut = (e) => {
        e.preventDefault();
      };

      const onPaste = (e) => {
        e.preventDefault();

        countViolation(
          "Pasting content is not allowed."
        );
      };

      const onDragStart = (e) => {
        e.preventDefault();
      };

      const onBeforeUnload = (e) => {
        e.preventDefault();

        e.returnValue =
          "Are you sure you want to leave the interview?";
      };

      // Best-effort devtools detection: a wide
      // outer-vs-inner gap usually means devtools
      // is docked to the window.
      devtoolsIntervalRef.current =
        setInterval(() => {
          if (!activeRef.current) return;

          const hDiff =
            window.outerHeight -
            window.innerHeight;

          const wDiff =
            window.outerWidth -
            window.innerWidth;

          if (hDiff > 160 || wDiff > 160) {
            countViolation(
              "Developer tools detected."
            );
          }
        }, 1000);

      handlersRef.current = {
        onVisibility,
        onBlur,
        onFullscreenChange,
        onKeyDown,
        onContextMenu,
        onCopy,
        onCut,
        onPaste,
        onDragStart,
        onBeforeUnload,
      };

      document.addEventListener(
        "visibilitychange",
        onVisibility
      );

      window.addEventListener(
        "blur",
        onBlur
      );

      document.addEventListener(
        "fullscreenchange",
        onFullscreenChange
      );

      window.addEventListener(
        "keydown",
        onKeyDown
      );

      window.addEventListener(
        "contextmenu",
        onContextMenu
      );

      window.addEventListener(
        "copy",
        onCopy
      );

      window.addEventListener(
        "cut",
        onCut
      );

      window.addEventListener(
        "paste",
        onPaste
      );

      window.addEventListener(
        "dragstart",
        onDragStart
      );

      window.addEventListener(
        "beforeunload",
        onBeforeUnload
      );

      enterFullscreen();
    }, [
      countViolation,
      enterFullscreen,
    ]);

  const stopProctoring =
    useCallback(() => {
      setActive(false);

      activeRef.current = false;

      if (devtoolsIntervalRef.current) {
        clearInterval(
          devtoolsIntervalRef.current
        );

        devtoolsIntervalRef.current =
          null;
      }

      const h = handlersRef.current;

      document.removeEventListener(
        "visibilitychange",
        h.onVisibility
      );

      window.removeEventListener(
        "blur",
        h.onBlur
      );

      document.removeEventListener(
        "fullscreenchange",
        h.onFullscreenChange
      );

      window.removeEventListener(
        "keydown",
        h.onKeyDown
      );

      window.removeEventListener(
        "contextmenu",
        h.onContextMenu
      );

      window.removeEventListener(
        "copy",
        h.onCopy
      );

      window.removeEventListener(
        "cut",
        h.onCut
      );

      window.removeEventListener(
        "paste",
        h.onPaste
      );

      window.removeEventListener(
        "dragstart",
        h.onDragStart
      );

      window.removeEventListener(
        "beforeunload",
        h.onBeforeUnload
      );

      exitFullscreen();
    }, [exitFullscreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProctoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    violationCount,
    warning,
    active,
    startProctoring,
    stopProctoring,
  };
}

export default useProctoring;
