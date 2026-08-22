const mongoose = require("mongoose");

const questionSetSchema = new mongoose.Schema({
  className: {
    type: String,
    required: true,
    unique: true,
  },

  // Full verified pool of questions (>= questionCount so each
  // student can receive a random subset). Each entry carries the
  // short expected-answer points used to slim AI evaluation prompts.
  questions: {
    type: [
      new mongoose.Schema(
        {
          text: {
            type: String,
            required: true,
          },

          expectedPoints: {
            type: String,
            default: "",
          },

          // MCQ format: exactly four answer options plus the zero-based
          // index of the correct one. Pools created before the MCQ
          // conversion have neither field and must be regenerated.
          options: {
            type: [String],
            default: undefined,
          },

          correctIndex: {
            type: Number,
            default: undefined,
            min: 0,
            max: 3,
          },

          difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium",
          },
        },
        { _id: false }
      ),
    ],
    default: [],
  },

  status: {
    type: String,
    enum: ["draft", "verified"],
    default: "draft",
  },

  // How many questions each student interview asks (mirrors Syllabus)
  questionCount: {
    type: Number,
    default: 20,
  },

  generatedBy: {
    type: String,
    default: "",
  },

  verifiedBy: {
    type: String,
    default: "",
  },

  verifiedAt: {
    type: Date,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "QuestionSet",
  questionSetSchema
);
