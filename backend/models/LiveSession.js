const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },

  interviewerUsername: {
    type: String,
    required: true,
  },

  className: {
    type: String,
    default: "",
  },

  studentUsername: {
    type: String,
    default: "",
  },

  status: {
    type: String,
    enum: ["waiting", "active", "ended"],
    default: "waiting",
  },

  score: {
    type: Number,
    default: null,
    min: 0,
    max: 10,
  },

  scoredAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "LiveSession",
  liveSessionSchema
);
