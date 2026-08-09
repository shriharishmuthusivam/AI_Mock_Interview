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

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "Interview",
  interviewSchema
);