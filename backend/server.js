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

const { signToken, authInterviewer, authStudent } = require("./middleware/auth");
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

// Rate limit the AI chat route to protect the Groq quota
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
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
// CREATE STUDENT (by an authenticated interviewer)
//
app.post(
  "/api/create-student",
  authLimiter,
  authInterviewer,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const credError = validateCredentials(username, password);

      if (credError) {
        return res.status(400).json({
          message: credError,
        });
      }

      // Check Existing Student
      const existingStudent = await Student.findOne({
        username: username.trim(),
      });

      if (existingStudent) {
        return res.status(400).json({
          message: "Student already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newStudent = new Student({
        username: username.trim(),
        password: hashedPassword,
        createdBy: req.interviewer.username,
      });

      await newStudent.save();

      res.json({
        message: "Student created successfully",
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

  const feedbackMatch = reply.match(/Feedback:\s*([\s\S]*?)(?:\n\s*Next Question:)/i);

  if (feedbackMatch) {
    feedback = feedbackMatch[1].trim();
  }

  return { score, feedback };
}

//
// AI CHAT + SAVE INTERVIEW
//
app.post(
  "/api/chat",
  chatLimiter,
  authStudent,
  async (req, res) => {
    try {
      const {
        message,
        subject,
        sessionId,
        question,
        violationCount,
        transcript,
      } = req.body;

      const studentUsername = req.student.username;

      // Only allow interviews for registered students
      const student = await Student.findOne({
        username: studentUsername,
      });

      if (!student) {
        return res.status(400).json({
          message: "Student not found",
        });
      }

      // Build the conversation history so the AI can track the interview
      const history = Array.isArray(transcript)
        ? transcript
            .filter(
              (m) =>
                m &&
                typeof m.content === "string" &&
                (m.role === "user" || m.role === "assistant")
            )
            .map((m) => ({ role: m.role, content: m.content }))
        : [];

      // AI Request
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",

          messages: [
            {
              role: "system",

              content:
`You are a professional technical interviewer for computer science students.

Conduct the interview ONLY for the subject: ${subject}.

For every student answer:
1. Evaluate the answer professionally
2. Give a score out of 10
3. Give short feedback
4. Mention missing points if necessary
5. Ask the next interview question

Rules:
- Ask only one question at a time
- Focus strictly on ${subject}
- Maintain professional interview tone
- Do not act like a casual chatbot
- Do not repeat questions you already asked
- Keep responses concise and interview-oriented

Response format:

Score: x/10

Feedback:
...

Next Question:
...`,
            },

            ...history,

            {
              role: "user",
              content: message,
            },
          ],

          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // AI Reply
      const reply = response.data.choices[0].message.content;

      const { score, feedback } = parseReply(reply);

      //
      // Save Interview
      //
      const newInterview = new Interview({
        studentUsername,
        interviewerUsername: student.createdBy || "",
        sessionId: sessionId || "",
        subject,
        question: question || "",
        answer: message,
        feedback,
        score,
        violationCount: Number(violationCount) || 0,
      });

      await newInterview.save();

      // Send Response
      res.json({
        reply,
        score,
        feedback,
      });
    } catch (error) {
      console.log("ERROR OCCURRED");
      console.log(error);

      res.status(500).json({
        error: "Something went wrong",
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
        subject: interviews[0].subject,
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
