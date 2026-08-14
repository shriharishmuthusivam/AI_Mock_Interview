const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  studentUsername: {
    type: String,
    required: true,
  },

  interviewerUsername: {
    type: String,
    default: "",
  },

  sessionId: {
    type: String,
    default: "",
  },

  subject: {
    type: String,
    required: true,
  },

  className: {
    type: String,
    default: "",
  },

  question: {
    type: String,
  },

  answer: {
    type: String,
  },

  feedback: {
    type: String,
  },

  score: {
    type: Number,
  },

  violationCount: {
    type: Number,
    default: 0,
  },

  completed: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "Interview",
  interviewSchema
);