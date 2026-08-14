require("dotenv").config();
const mongoose = require("mongoose");
const Interview = require("../models/Interview");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is not set — add it to backend/.env");
  process.exit(1);
}

async function backfill() {
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 60000,
  });

  const result = await Interview.updateMany(
    { completed: { $ne: true } },
    { $set: { completed: true } }
  );

  console.log(
    `Marked ${result.modifiedCount} interview session row(s) as completed.`
  );

  await mongoose.disconnect();
}

backfill().catch((error) => {
  console.error(error);
  process.exit(1);
});
