const mongoose = require("mongoose");

const interviewerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    default: "",
    trim: true,
    lowercase: true,
  },

  role: {
    type: String,
    enum: ["interviewer", "admin"],
    default: "interviewer",
  },

  plainPassword: {
    type: String,
    default: "",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "Interviewer",
  interviewerSchema
);
