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
const LiveSession = require("./models/LiveSession");

const multer = require("multer");
const xlsx = require("xlsx");

const {
  signToken,
  verifyToken,
  authInterviewer,
  authStudent,
} = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/error");
const { buildPdf, sendReportEmail } = require("./services/report");

require("dotenv").config();

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
const MAX_EXCLUSIONS = 10;
const MAX_EXCLUSION_CHARS = 120;
const MAX_HISTORY_MESSAGES = 6;
const MAX_MESSAGE_CHARS = 300;

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
// INTERVIEWER REGISTER
//
app.post(
  "/api/interviewer/register",
  authLimiter,
  async (req, res) => {
    try {
      const { username, password, email } = req.body;

      const credError = validateCredentials(username, password);

      if (credError) {
        return res.status(400).json({
          message: credError,
        });
      }

      if (!email || !EMAIL_REGEX.test(email)) {
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
        email: email.trim().toLowerCase(),
      });

      await newInterviewer.save();

      const token = signToken({
        username: newInterviewer.username,
        role: "interviewer",
      });

      res.json({
        message: "Interviewer registered successfully",
        token,
        username: newInterviewer.username,
        email: newInterviewer.email,
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
        role: "interviewer",
      });

      res.json({
        message: "Login successful",
        token,
        username: interviewer.username,
        email: interviewer.email,
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

      const existing = await Syllabus.findOne({ className });

      if (existing) {
        existing.syllabus = String(syllabus).trim();
        existing.questionCount = count;
        existing.updatedAt = Date.now();
        await existing.save();
      } else {
        const newSyllabus = new Syllabus({
          className,
          syllabus: String(syllabus).trim(),
          questionCount: count,
        });

        await newSyllabus.save();
      }

      res.json({
        message: "Syllabus saved",
        className,
        questionCount: count,
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

      res.json({
        className,
        configured: !!doc,
        questionCount: doc ? doc.questionCount : 0,
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

//
// Extract score (0-10) and feedback from the AI reply
//
function parseReply(reply) {
  let score = 0;

  const scoreMatch = reply.match(/Score:\s*(\d+)/i);

  if (scoreMatch) {
    score = Math.max(0, Math.min(10, Number(scoreMatch[1])));
  }

  let feedback = "";

  const feedbackMatch = reply.match(
    /Feedback:\s*([\s\S]*?)(?:\n\s*Next Question:|\n\s*Question:)?\s*$/i
  );

  if (feedbackMatch && feedbackMatch[1] && feedbackMatch[1].trim()) {
    feedback = feedbackMatch[1].trim();
  }

  return { score, feedback };
}

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

//
// AI CHAT + SAVE INTERVIEW (class syllabus based common interview)
//
app.post(
  "/api/chat",
  chatLimiter,
  authStudent,
  async (req, res) => {
    try {
      const {
        message,
        sessionId,
        question,
        violationCount,
        transcript,
        start,
        questionCount,
        questionIndex,
      } = req.body;

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

      const syllabus = syllabusDoc.syllabus;

      // Recently asked questions in this class (from other sessions)
      // so the AI does not repeat questions between students.
      const recent = await Interview.find({
        className,
        question: { $ne: "" },
      })
        .sort({ createdAt: -1 })
        .limit(40);

      const exclusions = [
        ...new Set(
          recent
            .filter((item) => item.sessionId !== sessionId)
            .map((item) => String(item.question || "").trim())
            .filter(Boolean)
        ),
      ]
        .slice(0, MAX_EXCLUSIONS)
        .map((q) =>
          q.length > MAX_EXCLUSION_CHARS
            ? q.slice(0, MAX_EXCLUSION_CHARS)
            : q
        );

      const history = Array.isArray(transcript)
        ? transcript
            .filter(
              (m) =>
                m &&
                typeof m.content === "string" &&
                (m.role === "user" || m.role === "assistant")
            )
            .slice(-MAX_HISTORY_MESSAGES)
            .map((m) => ({
              role: m.role,
              content:
                m.content.length > MAX_MESSAGE_CHARS
                  ? m.content.slice(0, MAX_MESSAGE_CHARS)
                  : m.content,
            }))
        : [];

      const totalCount = Number(questionCount) || syllabusDoc.questionCount;

      const currentIndex = Number(questionIndex) || 0;

      const remaining = totalCount - currentIndex;

      // Normalize whitespace and cap the syllabus so the whole Groq request
      // stays within the provider's token-per-minute limit.
      const syllabusContext = syllabus
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_SYLLABUS_CHARS);

      const baseSystem =
        `You are a professional technical interviewer for computer science students.\n\n` +
        `The student is in class: ${className}. ${difficultyNote(className)}\n\n` +
        `Every question MUST be based on the college syllabus below:\n\n` +
        `<SYLLABUS>\n${syllabusContext}\n</SYLLABUS>\n\n` +
        `Rules:\n` +
        `- Ask only ONE question at a time\n` +
        `- Questions must come from the syllabus topics\n` +
        `- Do not repeat any question you already asked in this interview\n` +
        (exclusions.length > 0
          ? `- Do not ask questions that other students have already received. Avoid: ${exclusions.join(
              " | "
            )}\n`
          : "") +
        `- Maintain a professional interview tone\n` +
        `- Do not act like a casual chatbot\n` +
        `- Keep responses concise and interview-oriented`;

      let aiMessages;
      let isStart = Boolean(start);

      if (isStart) {
        aiMessages = [
          {
            role: "system",
            content:
              baseSystem +
              `\n\nYour first task: ask the FIRST interview question based on the syllabus. ` +
              `Output ONLY the question text with no score, no feedback and no labels.`,
          },
          {
            role: "user",
            content: message || "Begin the interview.",
          },
        ];
      } else {
        const finalQuestion = remaining <= 0;

        aiMessages = [
          {
            role: "system",
            content:
              baseSystem +
              (finalQuestion
                ? `\n\nThis is the FINAL question. Evaluate the answer and give Score and Feedback only. Do NOT ask a next question.`
                : `\n\nFor every student answer:\n1. Evaluate the answer professionally\n2. Give a score out of 10\n3. Give short feedback\n4. Mention missing points if necessary\n5. Ask the next interview question based on the syllabus\n\nResponse format:\n\nScore: x/10\n\nFeedback:\n...\n\nNext Question:\n...`),
          },
          ...history,
          {
            role: "user",
            content: message,
          },
        ];
      }

      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: aiMessages,
          temperature: 0.8,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      let reply = response.data.choices[0].message.content;

      if (isStart) {
        reply = reply.replace(/^Question\s*:\s*/i, "").trim();

        return res.json({
          reply,
          start: true,
        });
      }

      const { score, feedback } = parseReply(reply);

      // The AI is told to always ask the next question, but if it forgets,
      // generate one ourselves so the interview always reaches the
      // configured question count.
      if (!finalQuestion && !/Next Question:/i.test(reply)) {
        try {
          const nextResponse = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: "llama-3.1-8b-instant",
              messages: [
                {
                  role: "system",
                  content:
                    baseSystem +
                    `\n\nYour task: ask the NEXT interview question based on the syllabus. ` +
                    `Output ONLY the question text with no score, no feedback and no labels.`,
                },
                {
                  role: "user",
                  content: "Ask the next interview question.",
                },
              ],
              temperature: 0.8,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
              },
            }
          );

          const nextQuestion = String(
            nextResponse.data.choices[0].message.content || ""
          )
            .replace(/^Question\s*:\s*/i, "")
            .trim();

          if (nextQuestion) {
            reply = `${reply}\n\nNext Question:\n${nextQuestion}`;
          }
        } catch (genError) {
          console.log("FAILED TO GENERATE NEXT QUESTION");
          console.log(genError.response?.status || genError.message);
        }
      }

      // Save this question/answer row
      const newInterview = new Interview({
        studentUsername,
        interviewerUsername: student.createdBy || "",
        sessionId: sessionId || "",
        subject: "Common Interview",
        className,
        question: question || "",
        answer: message,
        feedback,
        score,
        violationCount: Number(violationCount) || 0,
      });

      await newInterview.save();

      res.json({
        reply,
        score,
        feedback,
        remaining: Math.max(remaining - 1, 0),
      });
    } catch (error) {
      console.log("ERROR OCCURRED");
      console.log(error);

      const groqStatus = error.response?.status;
      const groqCode = error.response?.data?.error?.code;
      const groqMessage = error.response?.data?.error?.message;

      const promptTooLarge =
        groqStatus === 413 ||
        groqCode === "rate_limit_exceeded" ||
        (typeof groqMessage === "string" &&
          /too large|context|token|rate limit/i.test(groqMessage));

      const message = promptTooLarge
        ? "Could not generate the question — the class syllabus is too large for the AI provider's token limit. Please shorten the syllabus in Setup and try again."
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
