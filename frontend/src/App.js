import React, { useState } from "react";

import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { AnimatePresence, motion } from "framer-motion";

import LandingPage from "./pages/LandingPage";

import Login from "./pages/Login";

import InterviewerLogin from "./pages/InterviewerLogin";

import InterviewerRegister from "./pages/InterviewerRegister";

import Interview from "./pages/Interview";

import Setup from "./pages/Setup";

import Dashboard from "./pages/Dashboard";

import LiveInterview from "./pages/LiveInterview";

import ResultScreen from "./pages/ResultScreen";

import { ToastProvider } from "./components/Toast";

import AnimatedBackground from "./components/AnimatedBackground";

import { TOKEN_KEYS, USER_KEYS, clearAuth } from "./api";

function App() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem(TOKEN_KEYS.student)
  );

  const [student, setStudent] = useState(
    () => localStorage.getItem(USER_KEYS.student) || ""
  );

  const [isInterviewerLoggedIn, setIsInterviewerLoggedIn] = useState(
    () => !!localStorage.getItem(TOKEN_KEYS.interviewer)
  );

  const [showResult, setShowResult] = useState(false);

  const [totalScore, setTotalScore] = useState(0);

  const [maxScore, setMaxScore] = useState(100);

  const location = useLocation();

  const handleRestart = () => {
    setShowResult(false);

    setTotalScore(0);
  };

  const handleLogout = () => {
    clearAuth();

    setIsLoggedIn(false);

    setStudent("");

    setIsInterviewerLoggedIn(false);

    setShowResult(false);

    setTotalScore(0);

    setMaxScore(100);

    navigate("/");
  };

  return (
    <ToastProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.22,
            ease: "easeOut",
          }}
        >
          <Routes location={location}>
            {/* Landing Page */}
            <Route
              path="/"
              element={<LandingPage />}
            />

            {/* Student Login */}
            <Route
              path="/student-login"
              element={
                <Login
                  setIsLoggedIn={
                    setIsLoggedIn
                  }
                  setStudent={setStudent}
                />
              }
            />

            {/* Interview */}
            <Route
              path="/interview"
              element={
                isLoggedIn ? (
                  !showResult ? (
                    <Interview
                      student={student}
                      setShowResult={
                        setShowResult
                      }
                      setTotalScore={
                        setTotalScore
                      }
                      setMaxScore={
                        setMaxScore
                      }
                      onLogout={handleLogout}
                    />
                  ) : (
                    <ResultScreen
                      totalScore={totalScore}
                      maxScore={maxScore}
                      onRestart={handleRestart}
                      onLogout={handleLogout}
                    />
                  )
                ) : (
                  <Navigate
                    to="/student-login"
                    replace
                  />
                )
              }
            />

            {/* Interviewer Login */}
            <Route
              path="/interviewer-login"
              element={
                <InterviewerLogin
                  setIsInterviewerLoggedIn={
                    setIsInterviewerLoggedIn
                  }
                />
              }
            />

            {/* Interviewer Register */}
            <Route
              path="/interviewer-register"
              element={
                <InterviewerRegister
                  setIsInterviewerLoggedIn={
                    setIsInterviewerLoggedIn
                  }
                />
              }
            />

            {/* Setup (interviewer manages students + syllabus) */}
            <Route
              path="/setup"
              element={
                isInterviewerLoggedIn ? (
                  <Setup onLogout={handleLogout} />
                ) : (
                  <Navigate
                    to="/interviewer-login"
                    replace
                  />
                )
              }
            />

            {/* Live one-on-one video interview (student or interviewer) */}
            <Route
              path="/live/:code"
              element={
                isLoggedIn || isInterviewerLoggedIn ? (
                  <LiveInterview onLogout={handleLogout} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={
                isInterviewerLoggedIn ? (
                  <AnimatedBackground>
                    <Dashboard
                      onLogout={handleLogout}
                    />
                  </AnimatedBackground>
                ) : (
                  <Navigate
                    to="/interviewer-login"
                    replace
                  />
                )
              }
            />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </ToastProvider>
  );
}

export default App;
