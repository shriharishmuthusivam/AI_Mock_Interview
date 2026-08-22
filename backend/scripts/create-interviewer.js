require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Interviewer = require("../models/Interviewer");

const MONGO_URI = process.env.MONGO_URI;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!MONGO_URI) {
  console.error("MONGO_URI is not set — add it to backend/.env");
  process.exit(1);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1]
    ? process.argv[index + 1]
    : undefined;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const makeAdmin = hasArg("--admin");
  const noEmail = hasArg("--no-email");

  const username = (
    argValue("--username") ||
    process.env.NEW_INTERVIEWER_USERNAME ||
    (await ask("Username: "))
  ).trim();

  const emailRaw = noEmail
    ? ""
    : argValue("--email") ??
      process.env.NEW_INTERVIEWER_EMAIL ??
      (await ask("Email (optional, press Enter to skip): "));

  const email = String(emailRaw || "").trim().toLowerCase();

  const password =
    argValue("--password") ||
    process.env.NEW_INTERVIEWER_PASSWORD ||
    (await ask("Password: "));

  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }

  if (email && !EMAIL_REGEX.test(email)) {
    throw new Error("Please enter a valid email address");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 60000,
  });

  const existing = await Interviewer.findOne({ username });

  if (existing) {
    throw new Error("Interviewer already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const interviewer = await Interviewer.create({
    username,
    password: hashedPassword,
    plainPassword: password,
    email,
    role: makeAdmin ? "admin" : "interviewer",
  });

  console.log(
    `Interviewer created: ${interviewer.username} (${interviewer.email || "no email"}) role=${interviewer.role}`
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
