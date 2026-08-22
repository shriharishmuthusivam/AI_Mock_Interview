// One-time migration: convert legacy QuestionSet documents where
// `questions` is an array of plain strings into the new
// [{ text, expectedPoints }] shape. Safe to run multiple times.
//
// Usage: node scripts/migrate-questionsets.js

const mongoose = require("mongoose");

require("dotenv").config();

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);

  const coll = mongoose.connection.db.collection("questionsets");

  const result = await coll.updateMany(
    {},
    [
      {
        $set: {
          questions: {
            $map: {
              input: "$questions",
              as: "q",
              in: {
                $cond: [
                  { $eq: [{ $type: "$$q" }, "string"] },
                  { text: "$$q", expectedPoints: "" },
                  "$$q",
                ],
              },
            },
          },
        },
      },
    ]
  );

  console.log(
    `Migration complete — ${result.modifiedCount} document(s) updated`
  );

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
