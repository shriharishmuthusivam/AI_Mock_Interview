# Project Handoff Guide

This project is being handed off to a new team that will continue developing it.
Follow this guide to run it on your own machine.

## Requirements

- **Node.js LTS** (18 or 20+)
- A MongoDB database — easiest is a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster; a local `mongod` also works.
- A [Groq](https://console.groq.com) API key (free tier is enough). Interviews will not work without it.
- Optional: a Gmail/any SMTP account for PDF report emails (interviewer reports are emailed to the interviewer).

## Project layout

| Folder | What it is |
|---|---|
| `backend/` | Express + MongoDB API server (port 5000) |
| `frontend/` | React app (Create React App, dev port 3000) |

## Getting started

### 1. Backend

```
cd backend
npm install
```

Create the environment file:

```
copy .env.example .env
```

Then fill in `backend/.env`:

| Variable | Required | What it is |
|---|---|---|
| `GROQ_API_KEY` | Yes | AI key from https://console.groq.com |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Any long random string (change it) |
| `CLIENT_URL` | No | Frontend origin allowed by CORS (default `http://localhost:3000`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | No | Report email. If unset, reports are generated but email is skipped. |

Run the server:

```
npm start
```

or, for auto-reload while developing:

```
npm run dev
```

You should see `MongoDB Connected` and `Server running on port 5000`.

### 2. Frontend

```
cd frontend
npm install
npm start
```

Opens the app at `http://localhost:3000`. No config needed in development — the
frontend already points at `http://localhost:5000` and CORS defaults to
`http://localhost:3000`.

## First-time app setup

1. Register an interviewer account (also enters their email for report PDFs).
2. Log in as the interviewer → **Setup** → add a syllabus for each class and set the question count.
3. In **Setup**, upload students via the provided Excel template.
4. Log in as a student and take an interview to confirm the AI (Groq) works.

## Known gotchas

- **Class names are hardcoded** in two places and must stay in sync:
  - `frontend/src/constants.js` (`CLASSES`)
  - `backend/server.js` (`CLASSES`)
  If the college uses different class names, update both. They drive the syllabus setup, Excel upload, and AI difficulty guidance.
- **Groq API key is mandatory** — no interviews without it.
- **Each developer's database is independent** — there is no sync between local databases.
- **Camera/mic + live video only work on `localhost` or HTTPS** (browser security). A plain `http://<ip>` setup will block the camera and the Jitsi live room.
- **Known unfixed bug:** the dashboard/PDF report `Feedback` field can include the AI's "Next Question: ..." text (`parseReply` in `backend/server.js`). A verified fix exists (lookahead regex) but is not applied.
- The `completed` flag used by the interviewer dashboard is set when a report is generated; existing data can be backfilled once with `node backend/scripts/backfill-completed.js`.

## Handoff checklist (before sharing the folder)

Delete from any copy before transferring:

- `backend/node_modules/`
- `frontend/node_modules/`
- `frontend/build/`
- `backend/.env` (real credentials — the receiving team creates their own from `.env.example`)
- `server.out.log`, `server.err.log`, any `*.log`
- `.git/` (or hand off via a git remote instead)

If handing off via git: these are already covered by the root `.gitignore`
(`node_modules`, `.env`, `build`, `*.log`).
