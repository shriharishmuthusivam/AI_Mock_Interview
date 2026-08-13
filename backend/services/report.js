const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const BLUE = "#2563eb";
const PURPLE = "#7c3aed";
const DARK = "#0f172a";
const MUTED = "#64748b";

function buildPdf(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
    });

    doc.on("data", (chunk) => chunks.push(chunk));

    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);

    // Header bar
    doc
      .rect(0, 0, doc.page.width, 10)
      .fill(BLUE);

    doc
      .rect(0, 10, doc.page.width, 4)
      .fill(PURPLE);

    doc.moveDown(2);

    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor(DARK)
      .text("AI Mock Interview Report");

    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(MUTED)
      .text(`Generated on ${data.date}`, {
        continued: false,
      });

    doc.moveDown(1.5);

    // Details table
    const details = [
      ["Student", data.student],
      ["Class", data.className || "—"],
      ["Interview", data.subject || "Common Interview"],
      ["Interviewer", data.interviewer || "—"],
      ["Total Score", `${data.totalScore}/${data.entries.length * 10}`],
      ["Warnings (Violations)", String(data.violationCount || 0)],
    ];

    details.forEach(([label, value]) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(DARK)
        .text(`${label}`, { continued: true });

      doc
        .font("Helvetica")
        .fillColor(BLUE)
        .text(`   ${value}`);
    });

    doc.moveDown(1.5);
    doc.moveTo(56, doc.y);
    doc.lineTo(doc.page.width - 56, doc.y);
    doc.lineWidth(1);
    doc.strokeColor("#e2e8f0");
    doc.stroke();
    doc.moveDown(1);

    // Q&A entries
    data.entries.forEach((entry, index) => {
      const qNo = index + 1;

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(PURPLE)
        .text(`Q${qNo}: ${entry.question || "—"}`);

      doc.moveDown(0.4);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(DARK)
        .text("Answer:", { continued: true });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#334155")
        .text(`  ${entry.answer || "—"}`);

      doc.moveDown(0.4);

      const score = Number.isFinite(entry.score)
        ? `${entry.score}/10`
        : "—";

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(BLUE)
        .text(`Score: ${score}`, { continued: true });

      if (entry.feedback) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(MUTED)
          .text(`    Feedback: ${entry.feedback}`);
      } else {
        doc.text("");
      }

      doc.moveDown(1);
      doc.moveTo(56, doc.y);
      doc.lineTo(doc.page.width - 56, doc.y);
      doc.lineWidth(0.6);
      doc.strokeColor("#f1f5f9");
      doc.stroke();
      doc.moveDown(0.8);
    });

    // Footer
    const footer = doc.page.height - 40;

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text("AI Mock Interviewer — Proctored Interview Report", 56, footer, {
        width: doc.page.width - 112,
        align: "center",
      });

    doc.end();
  });
}

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE) !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendReportEmail({ to, student, subject, pdfBuffer }) {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      "SMTP not configured — skipping report email. Add SMTP_* to backend/.env to enable."
    );

    return false;
  }

  const safeName = `${student || "student"}-${(subject || "interview")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Interview Report — ${student} (${subject})`,
    text: `Hi,\n\nPlease find attached the interview report for ${student}.\n\nSubject: ${subject}\n\nAI Mock Interviewer`,
    attachments: [
      {
        filename: `${safeName}-report.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  console.log(`Report email sent to ${to}: ${info.messageId}`);

  return true;
}

module.exports = {
  buildPdf,
  sendReportEmail,
};
