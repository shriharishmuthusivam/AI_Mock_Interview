const mongoose = require("mongoose");

const syllabusSchema = new mongoose.Schema({
  className: {
    type: String,
    required: true,
    unique: true,
  },

  syllabus: {
    type: String,
    default: "",
  },

  questionCount: {
    type: Number,
    default: 20,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Syllabus", syllabusSchema);
