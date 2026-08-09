const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "12h",
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authInterviewer(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const payload = verifyToken(token);

    if (payload.role !== "interviewer") {
      return res.status(403).json({
        message: "Interviewer access required",
      });
    }

    req.interviewer = payload;

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

function authStudent(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const payload = verifyToken(token);

    if (payload.role !== "student") {
      return res.status(403).json({
        message: "Student access required",
      });
    }

    req.student = payload;

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

module.exports = {
  signToken,
  verifyToken,
  authInterviewer,
  authStudent,
};
