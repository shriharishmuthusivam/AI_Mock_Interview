require("dotenv").config();
const mongoose = require("mongoose");
const Interviewer = require("../models/Interviewer");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is not set — add it to backend/.env");
  process.exit(1);
}

async function main() {
  const username = process.argv[2]?.trim();

  if (!username) {
    throw new Error(
      "Usage: node scripts/set-admin.js <username>"
    );
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 60000,
  });

  const interviewer = await Interviewer.findOne({ username });

  if (!interviewer) {
    throw new Error(`Interviewer "${username}" not found`);
  }

  interviewer.role = "admin";
  await interviewer.save();

  console.log(
    `${interviewer.username} is now an admin`
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
