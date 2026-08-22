require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const Student = require("./models/Student");
const Interview = require("./models/Interview");
const Interviewer = require("./models/Interviewer");
const Syllabus = require("./models/Syllabus");
const QuestionSet = require("./models/QuestionSet");
const LiveSession = require("./models/LiveSession");

const multer = require("multer");
const xlsx = require("xlsx");

const {
  signToken,
  verifyToken,
  authInterviewer,
  authAdmin,
  authStudent,
} = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/error");
const { buildPdf, sendReportEmail } = require("./services/report");
const { completeChat } = require("./services/aiProvider");

if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
  console.warn(
    "WARNING: No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY in backend/.env and restart the server, or every interview will fail to start."
  );
}

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    console.log("MongoDB Connected")
  )
  .catch((err) =>
    console.log(err)
  );

const app = express();

// Trust the first proxy (Render/Railway/nginx) so rate
// limiting and CORS see the real client IP
app.set("trust proxy", 1);

// Only allow the frontend origin to call this API
app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:3000",
  })
);

app.use(express.json());

app.use(helmet());

// Health check for Render / uptime monitors
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Basic validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(username, password) {
  if (typeof username !== "string" || username.trim().length < 3) {
    return "Username must be at least 3 characters";
  }

  if (typeof password !== "string" || password.length < 6) {
    return "Password must be at least 6 characters";
  }

  return null;
}

// --- Fuzzy spreadsheet header matching -------------------------------
// Normalizes header names (lowercase, strips punctuation) so files using
// "Reg No", "Roll No", "ID", "D.No" etc. are still recognized.
function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const DNO_ALIASES = [
  "dno", "regno", "rollno", "reg", "roll",
  "registrationno", "registrationnumber", "id",
  "studentid", "username", "userid", "usn",
];

const NAME_ALIASES = [
  "name", "studentname", "fullname", "student", "nameofthestudent",
];

const PASSWORD_ALIASES = ["password", "pass"];

const CLASS_ALIASES = ["class", "classname", "course"];

function findCell(row, aliases) {
  const map = {};

  for (const key of Object.keys(row)) {
    map[normalizeKey(key)] = row[key];
  }

  for (const alias of aliases) {
    const value = map[alias];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function readCell(row, aliases) {
  const value = findCell(row, aliases);

  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

// Rate limit the AI chat route to protect the Groq quota. An interview is
// one start request plus one request per answer (up to 60 questions), so a
// single student must be able to finish an interview without tripping it.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit login / registration to slow down brute force
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Token-budget limits for the Groq prompt. The free Groq tier is capped at
// 6000 tokens/minute, so keep the whole request well under that.
const MAX_SYLLABUS_CHARS = 4000;

// Supported academic classes (order = difficulty progression)
const CLASSES = [
  "2nd B.Sc AI&ML",
  "3rd B.Sc AI&ML",
  "1st M.Sc AI",
  "2nd M.Sc AI",
];

// Accept CSV / Excel uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Home Route - Test Server
app.get("/", (req, res) => {
  res.send(
    "AI Mock Interviewer Backend Running"
  );
});

//
// INTERVIEWER LOGIN
//
app.post(
  "/api/interviewer-login",
  authLimiter,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const interviewer = await Interviewer.findOne({
        username: username?.trim(),
      });

      if (!interviewer) {
        return res.status(400).json({
          message: "Interviewer not found",
        });
      }

      const isMatch = await bcrypt.compare(password, interviewer.password);

      if (!isMatch) {
        return res.status(400).json({
          message: "Invalid password",
        });
      }

      const token = signToken({
        username: interviewer.username,
        role: interviewer.role || "interviewer",
      });

      res.json({
        message: "Login successful",
        token,
        username: interviewer.username,
        email: interviewer.email,
        role: interviewer.role || "interviewer",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// UPLOAD STUDENTS (DNo + password) from CSV / Excel, assigned to a class
//
app.post(
  "/api/students/upload",
  authInterviewer,
  upload.single("file"),
  async (req, res) => {
    try {
      const className = String(req.body.class || "").trim();

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Please choose a valid class",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Please upload a CSV or Excel file",
        });
      }

      const workbook = xlsx.read(req.file.buffer, {
        type: "buffer",
      });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = xlsx.utils.sheet_to_json(sheet, {
        defval: "",
        // Keep cell values as formatted strings so IDs like "0246202"
        // are not coerced to numbers and lose their leading zeros.
        raw: false,
      });

      if (rows.length === 0) {
        return res.status(400).json({
          message: "The file has no data rows",
        });
      }

      const defaultPassword = String(
        req.body.defaultPassword || ""
      );

      let created = 0;
      let updated = 0;
      const errors = [];

      for (const row of rows) {
        const dno = readCell(row, DNO_ALIASES);

        if (!dno || /^(undefined|null)$/i.test(dno)) {
          errors.push({
            row: row.__rowNum__ || "",
            error: "Missing or invalid DNo",
          });
          continue;
        }

        const name = readCell(row, NAME_ALIASES);

        // A "Class" column can override the uploaded class per row
        let rowClass = className;

        const fileClass = readCell(row, CLASS_ALIASES);

        if (fileClass && CLASSES.includes(fileClass)) {
          rowClass = fileClass;
        }

        let password = readCell(row, PASSWORD_ALIASES);

        if (!password && defaultPassword) {
          password = defaultPassword;
        }

        const existing = await Student.findOne({
          username: dno,
        });

        if (existing) {
          existing.className = rowClass;
          existing.name = name || existing.name;

          if (password) {
            existing.password = await bcrypt.hash(password, 10);
            existing.plainPassword = password;
          }

          await existing.save();
          updated += 1;
        } else {
          if (!password) {
            errors.push({ row: row.__rowNum__ || "", error: "No password" });
            continue;
          }

          const hashedPassword = await bcrypt.hash(password, 10);

          const newStudent = new Student({
            username: dno,
            password: hashedPassword,
            plainPassword: password,
            name,
            className: rowClass,
            createdBy: req.interviewer.username,
          });

          await newStudent.save();
          created += 1;
        }
      }

      res.json({
        message: `Imported ${created} new, updated ${updated}, skipped ${errors.length}`,
        created,
        updated,
        errors,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// ADD STUDENT MANUALLY (single record)
//
app.post(
  "/api/students",
  authInterviewer,
  async (req, res) => {
    try {
      const { username, name, className, password } = req.body;

      const dno = String(username || "").trim();

      if (!dno || dno.length < 3) {
        return res.status(400).json({
          message: "DNo must be at least 3 characters",
        });
      }

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Please choose a valid class",
        });
      }

      const pass = String(password || "");

      if (pass.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters",
        });
      }

      const existing = await Student.findOne({ username: dno });

      if (existing) {
        return res.status(400).json({
          message: `Student ${dno} already exists`,
        });
      }

      const hashedPassword = await bcrypt.hash(pass, 10);

      const newStudent = new Student({
        username: dno,
        password: hashedPassword,
        plainPassword: pass,
        name: String(name || "").trim(),
        className,
        createdBy: req.interviewer.username,
      });

      await newStudent.save();

      res.json({
        message: `Student ${dno} added`,
        _id: newStudent._id,
        username: newStudent.username,
        name: newStudent.name,
        className: newStudent.className,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// LIST STUDENTS (scoped to the logged-in interviewer)
//
app.get(
  "/api/students",
  authInterviewer,
  async (req, res) => {
    try {
      const students = await Student.find({
        createdBy: req.interviewer.username,
      }).sort({ createdAt: -1 });

      res.json(
        students.map((s) => ({
          _id: s._id,
          username: s.username,
          name: s.name,
          className: s.className,
          createdAt: s.createdAt,
        }))
      );
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// UPDATE STUDENT (class / name)
//
app.patch(
  "/api/students/:id",
  authInterviewer,
  async (req, res) => {
    try {
      const student = await Student.findOne({
        _id: req.params.id,
        createdBy: req.interviewer.username,
      });

      if (!student) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      const { className, name } = req.body;

      if (typeof className === "string") {
        if (className === "" || CLASSES.includes(className)) {
          student.className = className;
        }
      }

      if (typeof name === "string") {
        student.name = name.trim();
      }

      await student.save();

      res.json({
        message: "Student updated",
        _id: student._id,
        username: student.username,
        name: student.name,
        className: student.className,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// DELETE STUDENT
//
app.delete(
  "/api/students/:id",
  authInterviewer,
  async (req, res) => {
    try {
      const student = await Student.findOne({
        _id: req.params.id,
        createdBy: req.interviewer.username,
      });

      if (!student) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      await student.deleteOne();

      res.json({
        message: "Student deleted",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// SAVE CLASS SYLLABUS + QUESTION COUNT
//
app.post(
  "/api/syllabus",
  authInterviewer,
  async (req, res) => {
    try {
      const { className, syllabus, questionCount } = req.body;

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Please choose a valid class",
        });
      }

      if (!syllabus || String(syllabus).trim().length < 20) {
        return res.status(400).json({
          message: "Please paste a syllabus of at least 20 characters",
        });
      }

      const count = Number(questionCount);

      if (!Number.isInteger(count) || count < 1 || count > 60) {
        return res.status(400).json({
          message: "Question count must be between 1 and 60",
        });
      }

      const trimmed = String(syllabus).trim();

      const existing = await Syllabus.findOne({ className });

      const syllabusChanged =
        !existing || existing.syllabus !== trimmed;

      const countChanged =
        !existing || existing.questionCount !== count;

      if (existing) {
        existing.syllabus = trimmed;
        existing.questionCount = count;
        existing.updatedAt = Date.now();
        await existing.save();
      } else {
        const newSyllabus = new Syllabus({
          className,
          syllabus: trimmed,
          questionCount: count,
        });

        await newSyllabus.save();
      }

      // A verified question set is tied to the exact syllabus and
      // question count it was generated from — any change invalidates
      // it back to Draft so the interviewer must re-verify.
      let invalidatedSet = false;

      if (syllabusChanged || countChanged) {
        const result = await QuestionSet.updateMany(
          { className, status: "verified" },
          {
            $set: {
              status: "draft",
              verifiedAt: null,
              verifiedBy: "",
              updatedAt: Date.now(),
            },
          }
        );

        invalidatedSet = result.modifiedCount > 0;
      }

      res.json({
        message: "Syllabus saved",
        className,
        questionCount: count,
        questionsInvalidated: invalidatedSet,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// LIST ALL CLASS SYLLABI (interviewer)
//
app.get(
  "/api/syllabus",
  authInterviewer,
  async (req, res) => {
    try {
      const docs = await Syllabus.find({});

      res.json(docs);
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// CLASS CONFIG FOR THE STUDENT INTERVIEW (question count only)
//
app.get(
  "/api/syllabus/:className",
  authStudent,
  async (req, res) => {
    try {
      const className = req.params.className;

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Invalid class",
        });
      }

      const doc = await Syllabus.findOne({ className });

      const questionSet = await QuestionSet.findOne({ className });

      res.json({
        className,
        configured: !!doc,
        questionCount: doc ? doc.questionCount : 0,
        verified: !!questionSet && questionSet.status === "verified",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// GENERATE QUESTION POOL FROM SYLLABUS (interviewer)
//
const MAX_POOL_SIZE = 60;

app.post(
  "/api/questions/generate",
  authInterviewer,
  async (req, res) => {
    try {
      const { className } = req.body;

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Please choose a valid class",
        });
      }

      const syllabusDoc = await Syllabus.findOne({ className });

      if (!syllabusDoc || !syllabusDoc.syllabus) {
        return res.status(400).json({
          message:
            "Save the syllabus for this class first, then generate questions",
        });
      }

      const count = syllabusDoc.questionCount || 20;

      const poolSize = Math.min(count * 3, MAX_POOL_SIZE);

      const syllabusContext = syllabusDoc.syllabus
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_SYLLABUS_CHARS);

      const response = await completeChat({
        messages: [
          {
            role: "system",
            content:
              `You are a professional technical interviewer preparing a MULTIPLE-CHOICE question bank for computer science students.\n\n` +
              `The students are in class: ${className}. ${difficultyNote(className)}\n\n` +
              `Every question MUST be based on this college syllabus:\n\n` +
              `<SYLLABUS>\n${syllabusContext}\n</SYLLABUS>\n\n` +
              `Rules:\n` +
              `- Produce exactly ${poolSize} DISTINCT multiple-choice interview questions\n` +
              `- Each question must be ONE short sentence of at most 20 words\n` +
              `- Each question has EXACTLY FOUR options — mutually exclusive, similar length, with only ONE clearly correct choice\n` +
              `- Distractors must be believable common mistakes from the same topic — never jokes, "none of the above", or obviously wrong filler\n` +
              `- Spread the questions across DIFFERENT topics in the syllabus — do not ask several questions about the same narrow topic\n` +
              `- Difficulty split: about one third EASY, one third MEDIUM, one third HARD\n` +
              `- easy = direct recall or definitions of a single concept; medium = applying or comparing concepts; hard = analysis, scenarios or multi-step reasoning\n` +
              `- Every line MUST follow this exact format (the | separators are mandatory):\n` +
              `  N. The interview question? | option A ; option B ; option C ; option D | correct=B | expected point one; expected point two; expected point three | medium\n` +
              `- The correct= field is the capital letter (A, B, C, or D) of the single right option\n` +
              `- Expected points: exactly 3 short key concepts a student should know for this question, each at most 8 words, separated by "; "\n` +
              `- Difficulty: the last field is exactly one word — easy, medium, or hard\n` +
              `- NEVER use the | character inside a question, option, or point\n` +
              `- No preamble, no headings — output ONLY the numbered list`,
          },
          {
            role: "user",
            content: `Generate all ${poolSize} questions now in the exact format.`,
          },
        ],
        temperature: 0.9,
        maxTokens: 6000,
      });

      const raw = response.data.choices[0].message.content;

      // Extract numbered-list entries as MCQ objects
      // {text, options[4], correctIndex, expectedPoints, difficulty};
      // dedupe by text. Malformed lines are skipped.
      const seen = new Set();

      const questions = [];

      for (const line of String(raw || "").split(/\r?\n/)) {
        const match = line.match(/^\s*\d+\s*[\.\)]\s*(.+)$/);

        if (!match) continue;

        const parts = match[1].split("|");

        const text = parts[0]
          .replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, "")
          .trim();

        // Four answer options separated by ";"
        const options = (parts[1] || "")
          .split(";")
          .map((o) =>
            o
              .replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, "")
              .trim()
          )
          .filter(Boolean)
          .slice(0, 4);

        // Correct answer as a capital letter A-D -> zero-based index
        const rawCorrect = (parts[2] || "")
          .replace(/^\s*correct\s*(answer)?\s*[:=]?\s*/i, "")
          .trim()
          .toUpperCase()
          .slice(0, 1);

        const correctIndex = /^[A-D]$/.test(rawCorrect)
          ? rawCorrect.charCodeAt(0) - 65
          : -1;

        const points = (parts[3] || "")
          .replace(/^\s*expected( answer)? points?\s*:\s*/i, "")
          .replace(/[.。]+\s*$/, "")
          .trim();

        const rawLevel = (parts[4] || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z]/g, "");

        const difficulty = [
          "easy",
          "medium",
          "hard",
        ].includes(rawLevel)
          ? rawLevel
          : "medium";

        const key = text.toLowerCase();

        if (
          text &&
          text.length >= 8 &&
          text.length <= 200 &&
          options.length === 4 &&
          correctIndex >= 0 &&
          !seen.has(key)
        ) {
          seen.add(key);

          questions.push({
            text,
            options,
            correctIndex,
            expectedPoints: points.slice(0, 300),
            difficulty,
          });
        }
      }

      const withPoints = questions.filter(
        (q) => q.expectedPoints
      ).length;

      const levelCounts = questions.reduce(
        (acc, q) => {
          acc[q.difficulty] += 1;
          return acc;
        },
        { easy: 0, medium: 0, hard: 0 }
      );

      console.log(
        `[questions] generated ${questions.length} entries ` +
          `(${withPoints} with points) [easy:${levelCounts.easy} medium:${levelCounts.medium} hard:${levelCounts.hard}] for ${className}`
      );

      if (questions.length < count) {
        return res.status(502).json({
          message:
            "The AI did not produce enough valid questions. Please try generating again.",
        });
      }

      let set = await QuestionSet.findOne({ className });

      if (!set) {
        set = new QuestionSet({ className });
      }

      set.questions = questions;
      set.status = "draft";
      set.questionCount = count;
      set.generatedBy = req.interviewer.username;
      set.updatedAt = Date.now();

      await set.save();

      res.json({
        className,
        status: set.status,
        questionCount: count,
        questions,
      });
    } catch (error) {
      console.log("QUESTION GENERATION ERROR");
      console.log(error);

      const status = error.response?.status;

      const allProvidersBusy =
        status === 429 ||
        /rate limit/i.test(
          error.response?.data?.error?.message || ""
        );

      res.status(status === 429 || allProvidersBusy ? 429 : 500).json({
        message: allProvidersBusy
          ? "The AI service is busy right now. Wait a moment and try again."
          : "Failed to generate questions. Check that the AI service is configured on the server.",
      });
    }
  }
);

//
// VERIFY + PUBLISH A QUESTION POOL (interviewer)
//
app.post(
  "/api/questions/verify",
  authInterviewer,
  async (req, res) => {
    try {
      const { className, questions } = req.body;

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Please choose a valid class",
        });
      }

      const syllabusDoc = await Syllabus.findOne({ className });

      if (!syllabusDoc) {
        return res.status(400).json({
          message: "Save the syllabus first",
        });
      }

      const count = syllabusDoc.questionCount || 20;

      if (!Array.isArray(questions)) {
        return res.status(400).json({
          message: "Questions must be a list",
        });
      }

      const cleaned = [];

      const seen = new Set();

      for (const item of questions) {
        // Accept both plain strings (legacy clients) and
        // {text, expectedPoints} objects
        const text = String(
          typeof item === "object" && item !== null
            ? item.text
            : item || ""
        ).trim();

        const expectedPoints =
          typeof item === "object" && item !== null
            ? String(item.expectedPoints || "")
                .trim()
                .slice(0, 300)
            : "";

        const rawLevel =
          typeof item === "object" && item !== null
            ? String(item.difficulty || "")
                .trim()
                .toLowerCase()
            : "";

        // Difficulty is AI-assigned; the interviewer cannot edit it,
        // but we still whitelist whatever arrives.
        const difficulty = [
          "easy",
          "medium",
          "hard",
        ].includes(rawLevel)
          ? rawLevel
          : "medium";

        // MCQ options + correct answer index. A question without a
        // complete four-option set cannot be served in the MCQ
        // interview, so it is dropped here.
        const rawOptions =
          typeof item === "object" && item !== null &&
          Array.isArray(item.options)
            ? item.options.map((o) => String(o || "").trim())
            : [];

        const options = rawOptions
          .filter(Boolean)
          .map((o) => o.slice(0, 200));

        const correctIndexRaw =
          typeof item === "object" && item !== null
            ? Number(item.correctIndex)
            : NaN;

        const correctIndex =
          Number.isInteger(correctIndexRaw) &&
          correctIndexRaw >= 0 &&
          correctIndexRaw <= 3
            ? correctIndexRaw
            : -1;

        const key = text.toLowerCase();

        if (
          text &&
          options.length === 4 &&
          correctIndex >= 0 &&
          !seen.has(key)
        ) {
          seen.add(key);

          cleaned.push({
            text: text.slice(0, 300),
            expectedPoints,
            options,
            correctIndex,
            difficulty,
          });
        }
      }

      if (cleaned.length < count) {
        return res.status(400).json({
          message: `At least ${count} unique, complete multiple-choice questions are required to verify (currently ${cleaned.length}). Every question needs exactly four non-empty options and a selected correct answer.`,
        });
      }

      let set = await QuestionSet.findOne({ className });

      if (!set) {
        set = new QuestionSet({ className });
      }

      set.questions = cleaned;
      set.status = "verified";
      set.questionCount = count;
      set.verifiedBy = req.interviewer.username;
      set.verifiedAt = Date.now();
      set.updatedAt = Date.now();

      await set.save();

      res.json({
        className,
        status: set.status,
        questionCount: count,
        total: cleaned.length,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// GET CURRENT QUESTION POOL STATUS (interviewer)
//
app.get(
  "/api/questions/:className",
  authInterviewer,
  async (req, res) => {
    try {
      const className = req.params.className;

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Invalid class",
        });
      }

      const set = await QuestionSet.findOne({ className });

      res.json({
        className,
        status: set ? set.status : "none",
        questionCount: set ? set.questionCount : 0,
        questions: set ? normalizedQuestionPool(set) : [],
        verifiedBy: set ? set.verifiedBy : "",
        verifiedAt: set ? set.verifiedAt : null,
        updatedAt: set ? set.updatedAt : null,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// STUDENT LOGIN
//
app.post(
  "/api/student-login",
  authLimiter,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const student = await Student.findOne({
        username: username?.trim(),
      });

      if (!student) {
        return res.status(400).json({
          message: "Student not found",
        });
      }

      const isMatch = await bcrypt.compare(password, student.password);

      if (!isMatch) {
        return res.status(400).json({
          message: "Invalid password",
        });
      }

      const token = signToken({
        username: student.username,
        role: "student",
      });

      res.json({
        message: "Login successful",
        token,
        username: student.username,
        name: student.name,
        className: student.className,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// GET INTERVIEWS (scoped to the logged-in interviewer)
//
app.get(
  "/api/interviews",
  authInterviewer,
  async (req, res) => {
    try {
      const interviews = await Interview.find({
        interviewerUsername: req.interviewer.username,
      }).sort({ createdAt: -1 });

      res.json(interviews);
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// Difficulty guidance based on where the class sits in the academic order
function difficultyNote(className) {
  const index = CLASSES.indexOf(className);

  if (index <= 0) {
    return "This is an early undergraduate class. Focus on core concepts, definitions and clear explanations.";
  }

  if (index === 1) {
    return "This is a mid undergraduate class. Questions can require comparing concepts and applying them to simple problems.";
  }

  if (index === 2) {
    return "This is a postgraduate class. Questions should demand deeper understanding, design reasoning and analytical depth.";
  }

  return "This is an advanced postgraduate class. Questions should be challenging, applied and research-adjacent.";
}

// FNV-1a string hash -> 32-bit unsigned seed
function hashSeed(str) {
  let h = 2166136261;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);

    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

// Small deterministic PRNG so a session's question subset stays
// identical across every turn without server-side session state.
function mulberry32(seed) {
  let a = seed;

  return function () {
    a |= 0;

    a = (a + 0x6d2b79f5) | 0;

    let t = Math.imul(a ^ (a >>> 15), 1 | a);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ordered subset of the verified pool, stable per sessionId. The
// count splits ~⅓ across easy/medium/hard and is served easy →
// medium → hard so every interview warms up before it bites.
function pickSessionQuestions(pool, sessionId, count) {
  const rand = mulberry32(hashSeed(String(sessionId || "")));

  const shuffled = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));

      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
  };

  const buckets = { easy: [], medium: [], hard: [] };

  pool.forEach((q, i) => {
    const level =
      q.difficulty === "easy" || q.difficulty === "hard"
        ? q.difficulty
        : "medium";

    buckets[level].push(i);
  });

  Object.values(buckets).forEach((b) => shuffled(b));

  const base = Math.floor(count / 3);

  let remainder = count - base * 3;

  const quota = { easy: base, medium: base, hard: base };

  ["easy", "medium", "hard"].forEach((level) => {
    if (remainder > 0) {
      quota[level] += 1;

      remainder -= 1;
    }
  });

  const used = new Set();

  const selected = [];

  const take = (level, n) => {
    let taken = 0;

    for (const i of buckets[level]) {
      if (taken >= n || selected.length >= count) break;

      used.add(i);

      selected.push(pool[i]);

      taken += 1;
    }
  };

  take("easy", quota.easy);

  take("medium", quota.medium);

  take("hard", quota.hard);

  // Shortfalls from thin buckets top up from whatever remains,
  // preserving the seeded randomness.
  if (selected.length < count) {
    const rest = shuffled(
      pool.map((_, i) => i).filter((i) => !used.has(i))
    );

    for (const i of rest) {
      if (selected.length >= count) break;

      selected.push(pool[i]);
    }
  }

  return selected.slice(0, count);
}

// Tolerate legacy pools where questions were stored as plain
// strings — every downstream consumer gets one shape. `mcqReady`
// marks whether the entry can be served in the multiple-choice
// interview (four options + a valid correct index).
function normalizedQuestionPool(setDoc) {
  return (Array.isArray(setDoc.questions) ? setDoc.questions : [])
    .map((q) => {
      const base =
        typeof q === "string"
          ? {
              text: q,
              expectedPoints: "",
              options: [],
              correctIndex: -1,
              difficulty: "medium",
            }
          : {
              text: String(q.text || ""),
              expectedPoints: String(q.expectedPoints || ""),
              options: Array.isArray(q.options)
                ? q.options.map((o) => String(o || "").trim())
                : [],
              correctIndex: Number.isInteger(q.correctIndex)
                ? q.correctIndex
                : -1,
              difficulty: ["easy", "hard", "medium"].includes(
                String(q.difficulty)
              )
                ? String(q.difficulty)
                : "medium",
            };

      return {
        ...base,
        mcqReady:
          base.text.length > 0 &&
          base.options.length === 4 &&
          base.correctIndex >= 0 &&
          base.correctIndex <= 3 &&
          base.options.every(Boolean),
      };
    })
    .filter((q) => q.text);
}

// Deterministic per-session option shuffle. Stable within a session,
// different across sessions — so a screenshot of one student's screen
// doesn't reveal where the correct answer sits in another session.
function shuffledOptionsForSession(entry, sessionId, questionIndex) {
  const rand = mulberry32(
    hashSeed(`${String(sessionId || "")}::q${questionIndex}`)
  );

  const order = [0, 1, 2, 3];

  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));

    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    options: order.map((i) => entry.options[i]),
    correctIndex: order.indexOf(entry.correctIndex),
  };
}

//
// MCQ INTERVIEW (class syllabus based common interview)
//
app.post(
  "/api/chat",
  chatLimiter,
  authStudent,
  async (req, res) => {
    try {
      const {
        sessionId,
        start,
        finish,
        pickedIndex,
        violationCount,
        questionCount,
        questionIndex,
      } = req.body;

      if (
        !sessionId ||
        typeof sessionId !== "string" ||
        sessionId.length > 100
      ) {
        return res.status(400).json({
          message: "Session id is required",
        });
      }

      const studentUsername = req.student.username;

      const student = await Student.findOne({
        username: studentUsername,
      });

      if (!student) {
        return res.status(400).json({
          message: "Student not found",
        });
      }

      const className = student.className || "";

      if (!CLASSES.includes(className)) {
        return res.status(400).json({
          message: "No class assigned to this account",
        });
      }

      const syllabusDoc = await Syllabus.findOne({ className });

      if (!syllabusDoc || !syllabusDoc.syllabus) {
        return res.status(400).json({
          message: "No interview set up for your class yet",
        });
      }

      // Questions are only served from a verified pool that the
      // interviewer approved in Setup.
      const questionSetDoc = await QuestionSet.findOne({ className });

      if (
        !questionSetDoc ||
        questionSetDoc.status !== "verified" ||
        !Array.isArray(questionSetDoc.questions) ||
        questionSetDoc.questions.length === 0
      ) {
        return res.status(400).json({
          message:
            "Your interviewer has not verified the interview questions for your class yet. Please check back later.",
        });
      }

      const pool = normalizedQuestionPool(questionSetDoc);

      // Pools generated before the MCQ conversion carry no options —
      // they cannot be served and must be regenerated by the interviewer.
      if (!pool.every((q) => q.mcqReady)) {
        return res.status(400).json({
          message:
            "Your interviewer's question set predates the new multiple-choice format. Please ask them to regenerate and re-verify the questions.",
        });
      }

      const totalCount = Math.min(
        Number(questionCount) ||
          syllabusDoc.questionCount ||
          questionSetDoc.questionCount,
        pool.length
      );

      // The whole session paper is recomputed deterministically from the
      // sessionId on every request — no server-side session state, and a
      // tampered client cannot steer grading elsewhere. Option order is
      // shuffled per session so screenshots don't leak a fixed key.
      const paper = pickSessionQuestions(pool, sessionId, totalCount).map(
        (entry, i) => ({
          ...entry,
          ...shuffledOptionsForSession(entry, sessionId, i + 1),
        })
      );

      if (paper.length === 0) {
        return res.status(400).json({
          message: "No verified questions available for your class",
        });
      }

      const toPublicQuestion = (entry) => ({
        text: entry.text,
        difficulty: entry.difficulty,
        options: entry.options,
      });

      //
      // START — serve the first question WITHOUT the answer key
      //
      if (Boolean(start)) {
        return res.json({
          start: true,
          total: paper.length,
          question: { index: 1, ...toPublicQuestion(paper[0]) },
        });
      }

      //
      // FINISH — aggregate the saved answer rows, score deterministically,
      // then ONE cheap AI call writes a short personalized summary
      // (with a static fallback so results never depend on AI uptime).
      //
      if (Boolean(finish)) {
        const rows = await Interview.find({
          studentUsername,
          sessionId,
        }).sort({ questionNumber: 1, createdAt: 1 });

        // Defensive dedupe in case a retry slipped past the
        // already-answered guard.
        const seenNumbers = new Set();

        const uniqueRows = [];

        for (const row of rows) {
          const n = Number(row.questionNumber) || 0;

          if (seenNumbers.has(n)) continue;

          seenNumbers.add(n);

          uniqueRows.push(row);
        }

        if (uniqueRows.length === 0) {
          return res.status(400).json({
            message: "No recorded answers found for this session",
          });
        }

        const correctCount = uniqueRows.reduce(
          (acc, row) => acc + (Number(row.score) || 0),
          0
        );

        const breakdown = uniqueRows.map((row, i) => {
          const entry = paper[i] || null;

          return {
            text: String(row.question || ""),
            difficulty: entry ? entry.difficulty : "",
            yourAnswer: String(row.answer || ""),
            correctAnswer: entry ? entry.options[entry.correctIndex] : "",
            expectedPoints: entry ? entry.expectedPoints : "",
            correct: (Number(row.score) || 0) >= 1,
          };
        });

        const missed = breakdown.filter((b) => !b.correct);

        let summary = "";

        try {
          const wrongList = missed.length
            ? missed
                .map(
                  (b) =>
                    `- Q: ${b.text}\n  Expected knowledge: ${
                      b.expectedPoints || "(n/a)"
                    }`
                )
                .join("\n")
            : "- The student answered every question correctly.";

          const response = await completeChat({
            messages: [
              {
                role: "system",
                content:
                  `You are a professional technical interviewer writing a short result summary for a multiple-choice mock interview.\n\n` +
                  `The student is in class: ${className}. ${difficultyNote(className)}\n\n` +
                  `Result: ${correctCount} of ${breakdown.length} correct.\n\n` +
                  `Questions the student got wrong, with the knowledge they were missing:\n${wrongList}\n\n` +
                  `Rules:\n` +
                  `- At most 5 sentences total\n` +
                  `- First sentence: overall verdict\n` +
                  `- Then name the specific topics to revise based ONLY on the listed misses\n` +
                  `- Last sentence: one concrete study tip\n` +
                  `- Professional, encouraging tone. Plain text only.`,
              },
              {
                role: "user",
                content: "Write the result summary now.",
              },
            ],
            temperature: 0.4,
            maxTokens: 300,
          });

          summary = String(
            response.data.choices[0].message.content || ""
          ).trim();
        } catch (aiError) {
          console.log("SUMMARY AI FAILED — using static fallback");
          console.log(aiError.message);
        }

        if (!summary) {
          const pct = breakdown.length
            ? Math.round((correctCount / breakdown.length) * 100)
            : 0;

          summary =
            pct >= 80
              ? `Excellent result — ${correctCount} of ${breakdown.length} correct. Keep reinforcing that depth across every syllabus topic.`
              : pct >= 60
              ? `Good attempt — ${correctCount} of ${breakdown.length} correct. Revise the topics behind the questions you missed and retest yourself soon.`
              : pct >= 40
              ? `Average result — ${correctCount} of ${breakdown.length} correct. Focus on the missed topics below before retaking.`
              : `Needs improvement — ${correctCount} of ${breakdown.length} correct. Rebuild the fundamentals topic by topic, starting with the areas you missed.`;
        }

        return res.json({
          finished: true,
          score: correctCount,
          maxScore: breakdown.length,
          total: breakdown.length,
          summary,
          breakdown,
        });
      }

      //
      // ANSWER — grade the pick against the deterministic paper and save
      // the row. Correctness is NOT revealed until the result screen.
      //
      const currentIndex = Number(questionIndex) || 0;

      const answeredEntry = paper[Math.max(currentIndex - 1, 0)] || null;

      const picked = Number(pickedIndex);

      if (
        !answeredEntry ||
        !Number.isInteger(picked) ||
        picked < 0 ||
        picked > 3
      ) {
        return res.status(400).json({
          message: "Invalid answer submission",
        });
      }

      // Idempotency: a retried pick for an already-answered question
      // returns the same payload as a fresh success instead of an
      // error, so a flaky connection can never strand the student.
      const existingRow = await Interview.findOne({
        studentUsername,
        sessionId,
        questionNumber: currentIndex,
      });

      if (existingRow) {
        const nextEntry =
          currentIndex < paper.length ? paper[currentIndex] : null;

        return res.json({
          answered: currentIndex,
          remaining: Math.max(paper.length - currentIndex, 0),
          lastAnswered: !nextEntry,
          nextQuestion: nextEntry
            ? { index: currentIndex + 1, ...toPublicQuestion(nextEntry) }
            : null,
        });
      }

      const wasCorrect = picked === answeredEntry.correctIndex;

      const newInterview = new Interview({
        studentUsername,
        interviewerUsername: student.createdBy || "",
        sessionId,
        subject: "Common Interview",
        className,
        question: answeredEntry.text,
        answer: String(answeredEntry.options[picked] || "").slice(0, 200),
        feedback: wasCorrect
          ? ""
          : `Missed — expected: ${answeredEntry.expectedPoints}`.slice(
              0,
              300
            ),
        score: wasCorrect ? 1 : 0,
        questionNumber: currentIndex,
        violationCount: Number(violationCount) || 0,
      });

      await newInterview.save();

      const nextEntry =
        currentIndex < paper.length ? paper[currentIndex] : null;

      return res.json({
        answered: currentIndex,
        remaining: Math.max(paper.length - currentIndex, 0),
        lastAnswered: !nextEntry,
        nextQuestion: nextEntry
          ? { index: currentIndex + 1, ...toPublicQuestion(nextEntry) }
          : null,
      });
    } catch (error) {
      console.log("ERROR OCCURRED");
      console.log(error);

      const status = error.response?.status;

      const allProvidersBusy =
        status === 429 ||
        /rate limit/i.test(
          error.response?.data?.error?.message || ""
        );

      const message = allProvidersBusy
        ? "The AI service is currently busy with too many requests. Please wait a moment and try again."
        : "Something went wrong";

      res.status(500).json({
        error: message,
        message,
      });
    }
  }
);

//
// INTERVIEW REPORT (PDF emailed to the owning interviewer)
//
app.post(
  "/api/interview/report",
  authStudent,
  async (req, res) => {
    try {
      const { sessionId } = req.body;

      const studentUsername = req.student.username;

      if (!sessionId) {
        return res.status(400).json({
          message: "Session id is required",
        });
      }

      const interviews = await Interview.find({
        studentUsername,
        sessionId,
      }).sort({ createdAt: 1 });

      if (interviews.length === 0) {
        return res.status(404).json({
          message: "No interview found for this session",
        });
      }

      const totalScore = interviews.reduce(
        (acc, item) => acc + (Number(item.score) || 0),
        0
      );

      const interviewerUsername =
        interviews[0].interviewerUsername || "";

      const reportData = {
        student: studentUsername,
        subject: interviews[0].subject || "Common Interview",
        className: interviews[0].className || "",
        interviewer: interviewerUsername,
        date: new Date(interviews[0].createdAt).toLocaleString(),
        totalScore,
        violationCount:
          interviews[interviews.length - 1].violationCount || 0,
        entries: interviews.map((item) => ({
          question: item.question,
          answer: item.answer,
          score: Number(item.score) || 0,
          feedback: item.feedback,
        })),
      };

      const pdfBuffer = await buildPdf(reportData);

      await Interview.updateMany(
        { studentUsername, sessionId },
        { $set: { completed: true } }
      );

      let emailed = false;

      if (interviewerUsername) {
        const interviewer = await Interviewer.findOne({
          username: interviewerUsername,
        });

        if (interviewer && interviewer.email) {
          await sendReportEmail({
            to: interviewer.email,
            student: studentUsername,
            subject: interviews[0].subject,
            pdfBuffer,
          });

          emailed = true;
        }
      }

      res.json({
        message: emailed
          ? "Report generated and emailed"
          : "Report generated (no interviewer email configured)",
      });
    } catch (error) {
      console.log("REPORT ERROR OCCURRED");
      console.log(error);

      res.status(500).json({
        error: "Failed to generate report",
      });
    }
  }
);

//
// LIVE ONE-ON-ONE VIDEO INTERVIEWS (Jitsi rooms keyed by a short code)
//
// Characters that are unambiguous when read aloud / typed (no 0/O, 1/I).
const LIVE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateLiveCode(length = 6) {
  let code = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(
      Math.random() * LIVE_CODE_ALPHABET.length
    );

    code += LIVE_CODE_ALPHABET[index];
  }

  return code;
}

// A session is only visible to the interviewer who created it and the
// student who joined it. This stops a user with a guessed code from
// viewing or ending another interviewer's session.
function canAccessLiveSession(actor, session) {
  if (actor?.role === "interviewer") {
    return session.interviewerUsername === actor.username;
  }

  return Boolean(
    session.studentUsername &&
      actor?.role === "student" &&
      session.studentUsername === actor.username
  );
}

//
// CREATE A LIVE SESSION (interviewer)
//
app.post(
  "/api/live/create",
  authInterviewer,
  async (req, res) => {
    try {
      const className = String(req.body.className || "").trim();

      if (className && !CLASSES.includes(className)) {
        return res.status(400).json({
          message: "Please choose a valid class",
        });
      }

      let code;
      let attempts = 0;

      while (attempts < 10) {
        code = generateLiveCode();

        const existing = await LiveSession.findOne({ code });

        if (!existing) break;

        attempts += 1;
      }

      const session = new LiveSession({
        code,
        interviewerUsername: req.interviewer.username,
        className,
      });

      await session.save();

      res.json({
        message: "Live session created",
        code: session.code,
        className: session.className,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// JOIN A LIVE SESSION (student)
//
app.post(
  "/api/live/join",
  authStudent,
  async (req, res) => {
    try {
      const code = String(req.body.code || "")
        .trim()
        .toUpperCase();

      if (!code) {
        return res.status(400).json({
          message: "Please enter a room code",
        });
      }

      const session = await LiveSession.findOne({ code });

      if (!session) {
        return res.status(404).json({
          message: "Invalid room code",
        });
      }

      if (session.status === "ended") {
        return res.status(400).json({
          message: "This live session has ended",
        });
      }

      if (!session.studentUsername) {
        session.studentUsername = req.student.username;
      }

      session.status = "active";
      await session.save();

      res.json({
        message: "Joined live session",
        code: session.code,
        className: session.className,
        interviewerUsername: session.interviewerUsername,
        status: session.status,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// GET A LIVE SESSION SUMMARY (either role, for the room page)
//
app.get(
  "/api/live/:code",
  (req, res) => {
    handleLiveRoomAuth(req, res, async () => {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();

      const session = await LiveSession.findOne({ code });

      if (!session) {
        return res.status(404).json({
          message: "Invalid room code",
        });
      }

      // A student who opens a shared room link (with a valid code) is
      // treated as joining it, so a direct URL works without a separate
      // join call. Rooms already claimed by another student are not taken.
      if (
        req.student &&
        !session.studentUsername &&
        session.status !== "ended"
      ) {
        session.studentUsername = req.student.username;
        session.status = "active";
        await session.save();
      }

      const actor = req.interviewer || req.student;

      if (!canAccessLiveSession(actor, session)) {
        return res.status(403).json({
          message: "You do not have access to this room",
        });
      }

      res.json({
        code: session.code,
        className: session.className,
        interviewerUsername: session.interviewerUsername,
        studentUsername: session.studentUsername,
        status: session.status,
      });
    });
  }
);

//
// END A LIVE SESSION (either role)
//
app.post(
  "/api/live/:code/end",
  (req, res) => {
    handleLiveRoomAuth(req, res, async () => {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();

      const session = await LiveSession.findOne({ code });

      if (!session) {
        return res.status(404).json({
          message: "Invalid room code",
        });
      }

      const actor = req.interviewer || req.student;

      if (!canAccessLiveSession(actor, session)) {
        return res.status(403).json({
          message: "You do not have access to this room",
        });
      }

      if (session.status !== "ended") {
        session.status = "ended";
        await session.save();
      }

      res.json({
        message: "Live session ended",
        code: session.code,
        status: session.status,
      });
    });
  }
);

//
// SCORE A LIVE SESSION (interviewer only)
//
app.post(
  "/api/live/:code/score",
  authInterviewer,
  async (req, res) => {
    try {
      const code = String(req.params.code || "")
        .trim()
        .toUpperCase();

      const session = await LiveSession.findOne({ code });

      if (!session) {
        return res.status(404).json({
          message: "Invalid room code",
        });
      }

      if (
        session.interviewerUsername !== req.interviewer.username
      ) {
        return res.status(403).json({
          message: "You do not have access to this room",
        });
      }

      const score = Number(req.body.score);

      if (
        Number.isNaN(score) ||
        score < 0 ||
        score > 10
      ) {
        return res.status(400).json({
          message: "Score must be a number between 0 and 10",
        });
      }

      session.score = Math.round(score * 10) / 10;
      session.scoredAt = new Date();

      await session.save();

      res.json({
        message: "Score saved",
        code: session.code,
        score: session.score,
        scoredAt: session.scoredAt,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// GET ALL LIVE SESSIONS FOR INTERVIEWER
//
app.get(
  "/api/live-sessions",
  authInterviewer,
  async (req, res) => {
    try {
      const sessions = await LiveSession.find({
        interviewerUsername: req.interviewer.username,
      }).sort({ createdAt: -1 });

      res.json(
        sessions.map((s) => ({
          code: s.code,
          className: s.className,
          studentUsername: s.studentUsername,
          status: s.status,
          score: s.score,
          scoredAt: s.scoredAt,
          createdAt: s.createdAt,
        }))
      );
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// Shared auth for the room routes: accepts an interviewer OR student token
function handleLiveRoomAuth(req, res, handler) {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const payload = verifyToken(token);

    if (payload.role === "interviewer") {
      req.interviewer = payload;
    } else if (payload.role === "student") {
      req.student = payload;
    } else {
      return res.status(403).json({
        message: "Access required",
      });
    }

    return Promise.resolve(handler()).catch((err) => {
      console.log(err);

      if (!res.headersSent) {
        return res.status(500).json({
          message: "Server error",
        });
      }

      return null;
    });
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

//
// ADMIN — CREATE INTERVIEWER
//
app.post(
  "/api/admin/interviewers",
  authAdmin,
  async (req, res) => {
    try {
      const { username, password, email, makeAdmin } = req.body;

      const credError = validateCredentials(username, password);

      if (credError) {
        return res.status(400).json({
          message: credError,
        });
      }

      const cleanEmail = String(email || "").trim().toLowerCase();

      if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({
          message: "A valid email address is required",
        });
      }

      const existing = await Interviewer.findOne({
        username: username.trim(),
      });

      if (existing) {
        return res.status(400).json({
          message: "Interviewer already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newInterviewer = new Interviewer({
        username: username.trim(),
        password: hashedPassword,
        plainPassword: password,
        email: cleanEmail,
        role: makeAdmin ? "admin" : "interviewer",
      });

      await newInterviewer.save();

      res.json({
        message: `Interviewer ${newInterviewer.username} created`,
        username: newInterviewer.username,
        email: newInterviewer.email,
        role: newInterviewer.role,
        plainPassword: newInterviewer.plainPassword,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// ADMIN — LIST INTERVIEWERS
//
app.get(
  "/api/admin/interviewers",
  authAdmin,
  async (req, res) => {
    try {
      const interviewers = await Interviewer.find({}).sort({
        createdAt: -1,
      });

      res.json({
        interviewers: interviewers.map((i) => ({
          _id: i._id,
          username: i.username,
          email: i.email,
          role: i.role,
          plainPassword: i.plainPassword,
          createdAt: i.createdAt,
        })),
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// ADMIN — LIST STUDENTS
//
app.get(
  "/api/admin/students",
  authAdmin,
  async (req, res) => {
    try {
      const students = await Student.find({}).sort({
        createdAt: -1,
      });

      res.json({
        students: students.map((s) => ({
          _id: s._id,
          username: s.username,
          name: s.name,
          className: s.className,
          plainPassword: s.plainPassword,
          createdAt: s.createdAt,
        })),
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// ADMIN — RESET STUDENT PASSWORD
//
app.post(
  "/api/admin/students/:id/reset-password",
  authAdmin,
  async (req, res) => {
    try {
      const password = String(req.body.password || "");

      if (password.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters",
        });
      }

      const student = await Student.findById(req.params.id);

      if (!student) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      student.password = await bcrypt.hash(password, 10);
      student.plainPassword = password;

      await student.save();

      res.json({
        message: `Password updated for ${student.username}`,
        username: student.username,
        plainPassword: student.plainPassword,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// ADMIN — DELETE INTERVIEWER
//
app.delete(
  "/api/admin/interviewers/:id",
  authAdmin,
  async (req, res) => {
    try {
      const interviewer = await Interviewer.findById(req.params.id);

      if (!interviewer) {
        return res.status(404).json({
          message: "Interviewer not found",
        });
      }

      if (interviewer.username === req.admin.username) {
        return res.status(400).json({
          message: "You cannot delete your own account",
        });
      }

      if (interviewer.role === "admin") {
        const adminCount = await Interviewer.countDocuments({
          role: "admin",
        });

        if (adminCount <= 1) {
          return res.status(400).json({
            message: "Cannot delete the last admin account",
          });
        }
      }

      await interviewer.deleteOne();

      res.json({
        message: `Interviewer ${interviewer.username} deleted`,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

//
// ADMIN — DELETE STUDENT
//
app.delete(
  "/api/admin/students/:id",
  authAdmin,
  async (req, res) => {
    try {
      const student = await Student.findById(req.params.id);

      if (!student) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      await student.deleteOne();

      res.json({
        message: `Student ${student.username} deleted`,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// 404 + error handler
app.use(notFound);

app.use(errorHandler);

//
// SERVER
//
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
