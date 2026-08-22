const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  plainPassword: {
    type: String,
    default: "",
  },

  name: {
    type: String,
    default: "",
  },

  className: {
    type: String,
    default: "",
  },

  createdBy: {
    type: String,
    default: "",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "Student",
  studentSchema
);