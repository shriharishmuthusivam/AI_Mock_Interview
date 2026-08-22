import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import AnimatedBackground from "../components/AnimatedBackground";
import Dropdown from "../components/Dropdown";
import GradientButton from "../components/GradientButton";
import TextField from "../components/TextField";
import TypingIndicator from "../components/TypingIndicator";
import { useToast } from "../components/Toast";
import api from "../api";
import { CLASSES } from "../constants";
import { colors, fonts, gradients, radius, shadows } from "../styles/theme";

const MAX_QUESTIONS = 60;

// Must match MAX_SYLLABUS_CHARS in backend/server.js (the AI prompt budget)
const SYLLABUS_LIMIT = 4000;

function StudentsTab() {
  const toast = useToast();

  const [className, setClassName] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("dno@2026");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addDno, setAddDno] = useState("");
  const [addName, setAddName] = useState("");
  const [addClass, setAddClass] = useState("");
  const [addPassword, setAddPassword] = useState("dno@2026");
  const [adding, setAdding] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);

    try {
      const response = await api.get("/api/students", {
        authRole: "interviewer",
      });

      setStudents(response.data);
    } catch (error) {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async () => {
    if (!className) {
      toast.warning("Choose a class first");
      return;
    }

    if (!file) {
      toast.warning("Choose a CSV or Excel file");
      return;
    }

    setUploading(true);

    const formData = new FormData();

    formData.append("class", className);
    formData.append("defaultPassword", defaultPassword);
    formData.append("file", file);

    try {
      const response = await api.post(
        "/api/students/upload",
        formData,
        {
          authRole: "interviewer",
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      toast.success(response.data.message);

      if (response.data.errors && response.data.errors.length > 0) {
        const preview = response.data.errors
          .slice(0, 3)
          .map((e) => `Row ${e.row}: ${e.error}`)
          .join(" · ");

        toast.warning(
          `${response.data.errors.length} row(s) skipped — ${preview}`
        );
      }

      setFile(null);
      fetchStudents();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  const updateClass = async (student, nextClass) => {
    const previous = student.className;

    setStudents((prev) =>
      prev.map((s) =>
        s._id === student._id ? { ...s, className: nextClass } : s
      )
    );

    try {
      await api.patch(
        `/api/students/${student._id}`,
        { className: nextClass },
        { authRole: "interviewer" }
      );
    } catch (error) {
      setStudents((prev) =>
        prev.map((s) =>
          s._id === student._id ? { ...s, className: previous } : s
        )
      );

      toast.error("Failed to update class");
    }
  };

  const deleteStudent = async (student) => {
    if (!window.confirm(`Delete student ${student.username}?`)) return;

    try {
      await api.delete(`/api/students/${student._id}`, {
        authRole: "interviewer",
      });

      setStudents((prev) =>
        prev.filter((s) => s._id !== student._id)
      );

      toast.success("Student deleted");
    } catch (error) {
      toast.error("Failed to delete student");
    }
  };

  const addStudent = async () => {
    const dno = addDno.trim();

    if (!dno || dno.length < 3) {
      toast.warning("Enter a valid DNo (at least 3 characters)");
      return;
    }

    if (!addClass) {
      toast.warning("Choose a class");
      return;
    }

    if (addPassword.length < 6) {
      toast.warning("Password must be at least 6 characters");
      return;
    }

    setAdding(true);

    try {
      const response = await api.post(
        "/api/students",
        {
          username: dno,
          name: addName.trim(),
          className: addClass,
          password: addPassword,
        },
        { authRole: "interviewer" }
      );

      toast.success(response.data.message);

      setAddDno("");
      setAddName("");

      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add student");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={styles.section}>
      {/* Add student card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.card}
      >
        <h3 style={styles.cardTitle}>➕ Add Student</h3>

        <div style={styles.uploadRow}>
          <TextField
            label="DNo"
            placeholder="College DNo (e.g. 24BSCAI101)"
            icon="🪪"
            value={addDno}
            onChange={setAddDno}
            style={{ minWidth: 220 }}
          />

          <TextField
            label="Name"
            placeholder="Student name (optional)"
            icon="👤"
            value={addName}
            onChange={setAddName}
            style={{ minWidth: 220 }}
          />
        </div>

        <div style={styles.uploadRow}>
          <Dropdown
            value={addClass}
            onChange={setAddClass}
            options={CLASSES}
            placeholder="Select class…"
            style={styles.dropdownWrap}
          />

          <TextField
            label="Password"
            icon="🔑"
            value={addPassword}
            onChange={setAddPassword}
            style={{ minWidth: 220 }}
          />
        </div>

        <GradientButton
          onClick={addStudent}
          loading={adding}
          disabled={!addDno.trim() || !addClass}
          style={{ alignSelf: "flex-start" }}
        >
          {adding ? "Adding..." : "Add Student"}
        </GradientButton>
      </motion.div>

      {/* Upload card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.card}
      >
        <h3 style={styles.cardTitle}>📥 Import Students</h3>

        <p style={styles.cardSubtitle}>
          Upload a CSV or Excel file. The ID column can be named{" "}
          <b>DNo</b>, <b>Reg No</b>, <b>Roll No</b>, <b>ID</b> or{" "}
          <b>Username</b>. Optional columns: <b>Name</b>, <b>Password</b>,{" "}
          <b>Class</b> (per-row override). Rows without a password use the
          default password below; rows without an ID are skipped and listed in
          the result.
        </p>

        <div style={styles.uploadRow}>
          <Dropdown
            value={className}
            onChange={setClassName}
            options={CLASSES}
            placeholder="Select class…"
            style={styles.dropdownWrap}
          />

          <TextField
            label="Default password"
            placeholder="e.g. dno@2026"
            icon="🔑"
            value={defaultPassword}
            onChange={setDefaultPassword}
            style={{ minWidth: 220 }}
          />
        </div>

        <div style={styles.fileRow}>
          <label style={styles.fileLabel}>
            📄 {file ? file.name : "Choose CSV / Excel file"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files[0] || null)}
              style={styles.fileInput}
            />
          </label>

          <GradientButton
            onClick={handleUpload}
            loading={uploading}
            disabled={!className || !file}
          >
            {uploading ? "Uploading..." : "Upload Students"}
          </GradientButton>
        </div>
      </motion.div>

      {/* Students table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={styles.card}
      >
        <h3 style={styles.cardTitle}>👩‍🎓 Imported Students</h3>

        {loading ? (
          <p style={styles.emptyText}>Loading students…</p>
        ) : students.length === 0 ? (
          <p style={styles.emptyText}>
            No students imported yet. Upload a CSV or Excel file to begin.
          </p>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>DNo</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Class</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => (
                  <tr key={student._id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.mono}>{student.username}</span>
                    </td>

                    <td style={styles.td}>{student.name || "—"}</td>

                    <td style={styles.td}>
                      <Dropdown
                        value={student.className || ""}
                        onChange={(v) => updateClass(student, v)}
                        options={CLASSES}
                        emptyLabel="Unassigned"
                        small
                      />
                    </td>

                    <td style={styles.td}>
                      <button
                        onClick={() => deleteStudent(student)}
                        style={styles.deleteBtn}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SyllabusTab() {
  const toast = useToast();

  const [className, setClassName] = useState(CLASSES[0]);
  const [syllabus, setSyllabus] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [saving, setSaving] = useState(false);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);

  const [questions, setQuestions] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [qStatus, setQStatus] = useState("none");
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadClass(className);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className]);

  const loadClass = async (cls) => {
    setLoadingSyllabus(true);

    try {
      const [syllabusRes, questionsRes] =
        await Promise.all([
          api.get("/api/syllabus", {
            authRole: "interviewer",
          }),
          api.get(
            `/api/questions/${encodeURIComponent(cls)}`,
            { authRole: "interviewer" }
          ),
        ]);

      const doc = syllabusRes.data.find(
        (d) => d.className === cls
      );

      if (doc) {
        setSyllabus(doc.syllabus || "");
        setQuestionCount(doc.questionCount || 20);
      } else {
        setSyllabus("");
        setQuestionCount(20);
      }

      const setDoc = questionsRes.data;

      if (setDoc && Array.isArray(setDoc.questions)) {
        setQuestions(
          setDoc.questions.map((q) =>
            typeof q === "object" && q !== null
              ? {
                  text: String(q.text || ""),
                  expectedPoints: String(
                    q.expectedPoints || ""
                  ),
                  options:
                    Array.isArray(q.options) &&
                    q.options.length === 4
                      ? q.options.map((o) =>
                          String(o || "")
                        )
                      : ["", "", "", ""],
                  correctIndex:
                    Number.isInteger(q.correctIndex) &&
                    q.correctIndex >= 0 &&
                    q.correctIndex <= 3
                      ? q.correctIndex
                      : 0,
                  difficulty: ["easy", "hard", "medium"].includes(
                    String(q.difficulty)
                  )
                    ? String(q.difficulty)
                    : "medium",
                }
              : {
                  text: String(q || ""),
                  expectedPoints: "",
                  options: ["", "", "", ""],
                  correctIndex: 0,
                  difficulty: "medium",
                }
          )
        );

        setQStatus(setDoc.status);
      } else {
        setQuestions([]);
        setQStatus("none");
      }
    } catch (error) {
      toast.error("Failed to load class setup");
    } finally {
      setLoadingSyllabus(false);
    }
  };

  const saveSyllabus = async () => {
    if (!syllabus.trim() || syllabus.trim().length < 20) {
      toast.warning("Please paste a meaningful syllabus");
      return;
    }

    const count = Number(questionCount);

    if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
      toast.warning(`Question count must be 1–${MAX_QUESTIONS}`);
      return;
    }

    setSaving(true);

    try {
      const response = await api.post(
        "/api/syllabus",
        { className, syllabus, questionCount: count },
        { authRole: "interviewer" }
      );

      if (response.data.questionsInvalidated) {
        setQStatus((s) => (s === "verified" ? "draft" : s));
      }

      toast.success(
        response.data.questionsInvalidated
          ? `Saved — the verified questions were reset to Draft. Re-verify them for ${className}.`
          : `Saved — students of ${className} will get ${count} questions`
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const generateQuestions = async () => {
    if (!syllabus.trim() || syllabus.trim().length < 20) {
      toast.warning("Save a syllabus first, then generate questions");
      return;
    }

    setGenerating(true);

    try {
      const response = await api.post(
        "/api/questions/generate",
        { className },
        { authRole: "interviewer" }
      );

      setQuestions(response.data.questions || []);

      setQStatus(response.data.status || "draft");

      toast.success(
        `Generated ${(response.data.questions || []).length} questions — review and verify them`
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to generate questions"
      );
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (index, value) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index ? { ...q, text: value } : q
      )
    );

  const updatePoints = (index, value) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index ? { ...q, expectedPoints: value } : q
      )
    );

  const updateOption = (index, optIndex, value) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              options: q.options.map((o, j) =>
                j === optIndex ? value : o
              ),
            }
          : q
      )
    );

  const setCorrectOption = (index, optIndex) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index ? { ...q, correctIndex: optIndex } : q
      )
    );

  const togglePoints = (index) =>
    setExpanded((cur) => (cur === index ? null : index));

  const deleteQuestion = (index) => {
    setQuestions((prev) =>
      prev.filter((_, i) => i !== index)
    );

    setExpanded((cur) => (cur === index ? null : cur));
  };

  // A question is complete when its text and all four options are filled
  const answeredCount = () =>
    questions.filter(
      (q) =>
        String(q.text || "").trim() &&
        (q.options || []).every((o) => String(o || "").trim())
    ).length;

  const LEVEL_LABEL = {
    easy: "EASY",
    medium: "MED",
    hard: "HARD",
  };

  const verifyQuestions = async () => {
    const cleaned = questions
      .filter(
        (q) =>
          String(q.text || "").trim() &&
          (q.options || []).every((o) =>
            String(o || "").trim()
          )
      )
      .map((q) => ({
        text: String(q.text).trim(),
        expectedPoints: String(
          q.expectedPoints || ""
        ).trim(),
        options: q.options.map((o) =>
          String(o).trim()
        ),
        correctIndex: q.correctIndex,
        difficulty: ["easy", "hard", "medium"].includes(
          q.difficulty
        )
          ? q.difficulty
          : "medium",
      }));

    const count = Number(questionCount);

    if (cleaned.length < count) {
      toast.warning(
        `At least ${count} unique questions are required (currently ${cleaned.length}). Delete fewer or regenerate.`
      );
      return;
    }

    setVerifying(true);

    try {
      await api.post(
        "/api/questions/verify",
        { className, questions: cleaned },
        { authRole: "interviewer" }
      );

      setQuestions(cleaned);

      setQStatus("verified");

      toast.success(
        `Verified — ${className} students can now take the interview`
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to verify questions"
      );
    } finally {
      setVerifying(false);
    }
  };

  const statusLabel =
    qStatus === "verified"
      ? "Verified ✓"
      : qStatus === "draft"
      ? "Draft"
      : "Not generated";

  const statusStyle =
    qStatus === "verified"
      ? styles.badgeVerified
      : qStatus === "draft"
      ? styles.badgeDraft
      : styles.badgeNone;

  return (
    <div style={styles.section}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.card}
      >
        <div style={styles.cardHeadRow}>
          <h3 style={styles.cardTitle}>📚 Syllabus & Question Count</h3>

          <span style={{ ...styles.statusBadge, ...statusStyle }}>
            Questions: {statusLabel}
          </span>
        </div>

        <p style={styles.cardSubtitle}>
          Paste the college syllabus for a class and save it. Then generate
          the question pool with AI, review every question, and verify it —
          only verified classes unlock the student interview. Each student
          receives a random subset from your verified pool.
        </p>

        <div style={styles.uploadRow}>
          <Dropdown
            value={className}
            onChange={setClassName}
            options={CLASSES}
            style={styles.dropdownWrap}
          />

          <TextField
            label="Questions per interview"
            type="number"
            icon="❓"
            value={String(questionCount)}
            onChange={(v) => setQuestionCount(Number(v))}
            style={{ minWidth: 200 }}
          />
        </div>

        <label style={styles.syllabusLabel}>Syllabus (paste text)</label>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${className}:${loadingSyllabus ? "loading" : "ready"}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            style={styles.syllabusArea}
          >
            {loadingSyllabus ? (
              <div style={styles.syllabusLoading}>
                <TypingIndicator />
              </div>
            ) : (
              <>
                <textarea
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value)}
                  placeholder={`Paste the complete ${className} syllabus here…`}
                  style={styles.textarea}
                />

                <div style={styles.limitRow}>
                  <span style={styles.charCount}>
                    {syllabus.length.toLocaleString()} /{" "}
                    {SYLLABUS_LIMIT.toLocaleString()} characters
                  </span>

                  {syllabus.length > SYLLABUS_LIMIT && (
                    <span style={styles.limitWarning}>
                      ⚠ {syllabus.length.toLocaleString()} characters — the AI
                      will only use the first{" "}
                      {SYLLABUS_LIMIT.toLocaleString()} characters. Shorten the
                      syllabus so later topics aren't cut off.
                    </span>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <GradientButton
          onClick={saveSyllabus}
          loading={saving}
          disabled={loadingSyllabus}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Saving..." : "Save Syllabus"}
        </GradientButton>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        style={styles.card}
      >
        <div style={styles.cardHeadRow}>
          <h3 style={styles.cardTitle}>
            📝 Review & Verify Questions
          </h3>

          <span style={{ ...styles.statusBadge, ...statusStyle }}>
            {statusLabel}
          </span>
        </div>

        <p style={styles.cardSubtitle}>
          Step 1: save the syllabus above. Step 2: generate the AI question
          pool ({Math.min(Number(questionCount) * 3, MAX_QUESTIONS)}{" "}
          questions). Step 3: edit or delete anything you disagree with.
          Step 4: verify & publish — students can then start interviewing.
        </p>

        <GradientButton
          onClick={generateQuestions}
          loading={generating}
          disabled={loadingSyllabus || saving}
          style={{ alignSelf: "flex-start" }}
        >
          {generating
            ? "Generating..."
            : questions.length > 0
            ? "↻ Regenerate Question Pool"
            : "⚡ Generate Questions from Syllabus"}
        </GradientButton>

        {questions.length > 0 && (
          <>
            <div style={styles.qListHeader}>
              <span style={styles.charCount}>
                {answeredCount()} question(s) — need at least{" "}
                {Number(questionCount)} to verify
              </span>
            </div>

            <div style={styles.qList}>
              {questions.map((q, i) => (
                <div key={`${className}-q-${i}`} style={styles.qItem}>
                  <div style={styles.qRow}>
                    <span style={styles.qIndex}>{i + 1}.</span>

                    <span
                      style={{
                        ...styles.levelPill,
                        ...(q.difficulty === "easy"
                          ? styles.levelEasy
                          : q.difficulty === "hard"
                          ? styles.levelHard
                          : styles.levelMedium),
                      }}
                      title={`AI-assigned difficulty: ${q.difficulty}`}
                    >
                      {LEVEL_LABEL[q.difficulty] || "MED"}
                    </span>

                    <input
                      value={q.text}
                      onChange={(e) => updateQuestion(i, e.target.value)}
                      placeholder="Interview question…"
                      style={styles.qInput}
                    />

                    <button
                      onClick={() => togglePoints(i)}
                      style={{
                        ...styles.qToggle,
                        ...(q.options || []).every((o) =>
                          String(o).trim()
                        )
                          ? styles.qToggleHas
                          : {},
                      }}
                      title="Options & answer key"
                    >
                      {expanded === i ? "▴" : "▾"}
                    </button>

                    <button
                      onClick={() => deleteQuestion(i)}
                      style={styles.deleteBtn}
                      title="Delete question"
                    >
                      ✕
                    </button>
                  </div>

                  {expanded === i && (
                    <div style={styles.qEditor}>
                      {(q.options || ["", "", "", ""]).map(
                        (opt, j) => (
                          <div
                            key={`${className}-q-${i}-opt-${j}`}
                            style={styles.optRow}
                          >
                            <button
                              onClick={() =>
                                setCorrectOption(i, j)
                              }
                              style={{
                                ...styles.optRadio,
                                ...(q.correctIndex === j
                                  ? styles.optRadioOn
                                  : {}),
                              }}
                              title={
                                q.correctIndex === j
                                  ? "Correct answer"
                                  : "Mark as correct answer"
                              }
                            >
                              {q.correctIndex === j
                                ? "✓"
                                : String.fromCharCode(65 + j)}
                            </button>

                            <input
                              value={opt}
                              onChange={(e) =>
                                updateOption(i, j, e.target.value)
                              }
                              placeholder={`Option ${
                                String.fromCharCode(65 + j)
                              }…`}
                              style={{
                                ...styles.optInput,
                                ...(q.correctIndex === j
                                  ? styles.optInputCorrect
                                  : {}),
                              }}
                            />
                          </div>
                        )
                      )}

                      <textarea
                        value={q.expectedPoints}
                        onChange={(e) =>
                          updatePoints(i, e.target.value)
                        }
                        placeholder="Expected knowledge, e.g. overfitting; regularization; cross-validation — shown to students who miss this question and used in their AI result summary"
                        style={styles.qPoints}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <GradientButton
              onClick={verifyQuestions}
              loading={verifying}
              disabled={verifying || answeredCount() < Number(questionCount)}
              style={{ alignSelf: "flex-start" }}
            >
              {verifying
                ? "Verifying..."
                : qStatus === "verified"
                ? "✓ Verified — Re-publish Changes"
                : "✅ Verify & Publish"}
            </GradientButton>
          </>
        )}

        {!generating && questions.length === 0 && !loadingSyllabus && (
          <p style={styles.emptyText}>
            No question pool yet for {className} — generate one after saving
            the syllabus.
          </p>
        )}
      </motion.div>
    </div>
  );
}

function Setup({ onLogout }) {
  const navigate = useNavigate();

  const [tab, setTab] = useState("students");

  return (
    <AnimatedBackground>
      <div style={styles.page}>
        <div style={styles.navRow}>
          <button
            onClick={() => navigate("/dashboard")}
            style={styles.navBack}
          >
            ← Back
          </button>

          <button onClick={onLogout} style={styles.navLogout}>
            Logout
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.header}
        >
          <h1 style={styles.title}>Interview Setup</h1>

          <p style={styles.subtitle}>
            Import student DNo/password accounts and configure the syllabus
            for each class
          </p>
        </motion.div>

        <div style={styles.tabs}>
          {[
            { key: "students", label: "👩‍🎓 Students" },
            { key: "syllabus", label: "📚 Syllabus" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tab,
                ...(tab === t.key ? styles.tabActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "students" ? <StudentsTab /> : <SyllabusTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AnimatedBackground>
  );
}

const styles = {
  page: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "30px 24px 60px",
    fontFamily: fonts.family,
    color: colors.text,
  },

  navRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  navBack: {
    padding: "9px 18px",
    borderRadius: radius.pill,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  navLogout: {
    padding: "9px 18px",
    borderRadius: radius.pill,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(239,68,68,0.12)",
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s",
  },

  header: {
    textAlign: "center",
    marginBottom: 24,
  },

  title: {
    fontSize: 38,
    fontWeight: 800,
    margin: "0 0 8px",
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    margin: 0,
  },

  tabs: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginBottom: 24,
  },

  tab: {
    padding: "11px 26px",
    borderRadius: radius.pill,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.05)",
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "all 0.2s",
  },

  tabActive: {
    background: gradients.primary,
    color: "white",
    border: "none",
    boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  card: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: "22px 24px",
    boxShadow: shadows.card,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },

  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
  },

  uploadRow: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-end",
  },

  dropdownWrap: {
    flex: 1,
    minWidth: 240,
  },

  fileRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
  },

  fileLabel: {
    flex: 1,
    minWidth: 240,
    padding: "14px 18px",
    borderRadius: radius.md,
    border: `1px dashed ${colors.border}`,
    background: "rgba(255,255,255,0.03)",
    color: colors.textMuted,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: fonts.family,
  },

  fileInput: {
    display: "none",
  },

  syllabusLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.family,
    marginTop: 4,
  },

  syllabusArea: {
    display: "flex",
    flexDirection: "column",
  },

  syllabusLoading: {
    minHeight: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    border: `1px dashed ${colors.border}`,
    background: "rgba(255,255,255,0.03)",
  },

  textarea: {
    minHeight: 260,
    padding: "14px 16px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.family,
    outline: "none",
    lineHeight: 1.6,
    resize: "vertical",
    boxSizing: "border-box",
  },

  limitRow: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 6,
  },

  charCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
    fontWeight: 600,
    textAlign: "right",
  },

  limitWarning: {
    color: colors.dangerLight,
    fontSize: 13,
    lineHeight: 1.5,
    padding: "8px 12px",
    borderRadius: radius.md,
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(248,113,113,0.4)",
  },

  tableScroll: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 520,
  },

  th: {
    textAlign: "left",
    padding: "10px 12px",
    color: colors.textMuted,
    fontSize: 13,
    borderBottom: `1px solid ${colors.border}`,
  },

  tr: {
    borderBottom: `1px solid ${colors.border}`,
  },

  td: {
    padding: "10px 12px",
    fontSize: 14,
    color: colors.text,
  },

  mono: {
    fontFamily: fonts.mono,
    fontWeight: 600,
  },

  deleteBtn: {
    padding: "6px 14px",
    borderRadius: radius.pill,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(239,68,68,0.12)",
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
  },

  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    padding: "18px 0",
    margin: 0,
  },

  cardHeadRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  statusBadge: {
    padding: "6px 14px",
    borderRadius: radius.pill,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: fonts.family,
    whiteSpace: "nowrap",
  },

  badgeVerified: {
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.45)",
    color: "#86efac",
  },

  badgeDraft: {
    background: "rgba(245,158,11,0.14)",
    border: "1px solid rgba(245,158,11,0.45)",
    color: "#fcd34d",
  },

  badgeNone: {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${colors.border}`,
    color: colors.textMuted,
  },

  qListHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  qList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 420,
    overflowY: "auto",
    paddingRight: 4,
  },

  qRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  qItem: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  qToggle: {
    padding: "9px 12px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.05)",
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.family,
    cursor: "pointer",
    lineHeight: 1,
    transition: "all 0.2s",
  },

  qToggleHas: {
    background: "rgba(37,99,235,0.16)",
    border: "1px solid rgba(59,130,246,0.45)",
    color: "#93c5fd",
  },

  qPoints: {
    width: "100%",
    minHeight: 54,
    marginLeft: 38,
    padding: "10px 14px",
    borderRadius: radius.md,
    border: `1px dashed ${colors.border}`,
    background: "rgba(255,255,255,0.03)",
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.family,
    outline: "none",
    lineHeight: 1.5,
    resize: "vertical",
    boxSizing: "border-box",
  },

  qEditor: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    margin: "10px 0 4px 38px",
  },

  optRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  optRadio: {
    minWidth: 26,
    height: 26,
    borderRadius: "50%",
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.05)",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 700,
    fontFamily: fonts.mono,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  },

  optRadioOn: {
    background: "rgba(34,197,94,0.25)",
    border: "1px solid rgba(74,222,128,0.6)",
    color: "#4ade80",
  },

  optInput: {
    flex: 1,
    padding: "9px 12px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    outline: "none",
    fontSize: 13,
    background: "rgba(255,255,255,0.05)",
    color: colors.text,
    fontFamily: fonts.family,
    transition: "border-color 0.2s",
  },

  optInputCorrect: {
    borderColor: "rgba(74,222,128,0.55)",
    background: "rgba(34,197,94,0.08)",
  },

  qIndex: {
    minWidth: 28,
    textAlign: "right",
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
    fontWeight: 600,
  },

  levelPill: {
    padding: "4px 9px",
    borderRadius: radius.pill,
    fontSize: 11,
    fontWeight: 800,
    fontFamily: fonts.family,
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  levelEasy: {
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.45)",
    color: "#86efac",
  },

  levelMedium: {
    background: "rgba(245,158,11,0.14)",
    border: "1px solid rgba(245,158,11,0.45)",
    color: "#fcd34d",
  },

  levelHard: {
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.45)",
    color: "#fca5a5",
  },

  qInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: colors.surfaceStrong,
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.family,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
    minWidth: 0,
  },
};

export default Setup;
