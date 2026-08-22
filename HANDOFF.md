# Project Handoff Guide

This project is being handed off to a new team that will continue developing it.
Follow this guide to run it on your own machine.

## Requirements

- **Node.js LTS** (18 or 20+)
- **MongoDB Community Server** (local) — or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster as an alternative.
- A [Groq](https://console.groq.com) API key (free tier is enough). Interviews will not work without it.
- Optional but recommended: a free [Gemini API key](https://aistudio.google.com) — used as an automatic fallback when Groq hits its rate limits (see "AI provider failover" below).
- Optional: a Gmail/any SMTP account for PDF report emails (interviewer reports are emailed to the interviewer).

## Local MongoDB setup (recommended)

1. Download **MongoDB Community Server** from https://www.mongodb.com/try/download/community (Windows MSI, or the Linux package).
2. Install it — on Windows keep the default and let it install MongoDB as a **service** (starts automatically).
3. Verify it is running:
   - Windows: `Get-Service MongoDB` should show `Running`.
   - Linux: `sudo systemctl status mongod` should show `active (running)`.
4. Optional: install **MongoDB Compass** (https://www.mongodb.com/products/compass) to browse the data.

No database creation is needed — the app creates `ai_mock_interview` automatically on first run.

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
| `GROQ_MODEL` | No | Model used for interviews (default `llama-3.1-8b-instant`) |
| `GEMINI_API_KEY` | No | Free Gemini key from https://aistudio.google.com — automatic fallback when Groq is rate-limited |
| `GEMINI_MODEL` | No | Gemini model used for the fallback (default `gemini-3.6-flash`; confirm the current free Flash model in AI Studio) |
| `MONGO_URI` | Yes | MongoDB connection string. Local default: `mongodb://127.0.0.1:27017/ai_mock_interview`. For Atlas: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ai_mock_interview?retryWrites=true&w=majority` |
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

1. Create an interviewer account with the admin script (see below).
2. Log in as the interviewer → **Setup** → add a syllabus for each class and set the question count.
3. In **Setup**, upload students via the provided Excel template.
4. Log in as a student and take an interview to confirm the AI (Groq) works.

## Creating interviewer accounts

Interviewer registration is intentionally closed — there is **no public sign-up
page**. Interviewer accounts are created only by an administrator:

```
cd backend
npm run create-interviewer -- --username jane --email jane@college.edu --password "your-password"
```

It also works interactively (omit any of the flags and the script will prompt):

```
npm run create-interviewer
```

Or via environment variables: `NEW_INTERVIEWER_USERNAME`,
`NEW_INTERVIEWER_EMAIL`, `NEW_INTERVIEWER_PASSWORD` (useful for scripting).
Prefer flags/prompts over putting the password in shell history; the username and
email must be unique.

### Admin accounts

There are two ways to create an **admin** account (role `admin`):

- `npm run create-interviewer -- --username admin --password "secret" --admin` (email optional — pass `--no-email` to skip it non-interactively)
- Promote an existing interviewer: `npm run set-admin <username>`

The current admin is **`Dept of AI SJC`** (the password is set at creation; change
it with the reset flow if it leaks).

## Admin panel

There is a separate admin area at **`/admin-login`** (landing page → 🛡️ Admin
Login), guarded by the `authAdmin` middleware (a plain interviewer token gets
403). An admin can:

- **Create interviewer accounts** (username, optional email, password) — or grant
  admin access via the checkbox.
- **See all interviewers** (username, email, role, password) and **all students**
  (username, name, class, password).
- **Reset any student's password** (a new value is shown to the admin so it can
  be relayed to the student).
- **Delete an interviewer or student account** (row's Delete button, with a
  confirmation). Guards: an admin cannot delete their own account, and the last
  remaining admin cannot be deleted. Deleting a student keeps their interview
  history in the database (audit trail) — only the account/login is removed.

> ⚠️ **Plaintext password caveat.** The `plainPassword` fields on the `Student`
> and `Interviewer` models store a plaintext copy so the admin panel can display
> credentials. This is a deliberate, admin-only convenience — **if the database
> leaks, every stored password leaks.** Accounts created *before* this feature
> have an empty `plainPassword` (bcrypt is one-way, so their old passwords cannot
> be recovered; use Reset Password to set a new one). Only new/reset accounts get
> a plaintext copy. Remove the `plainPassword` fields if that risk is not
> acceptable.

## AI provider failover

The backend (`backend/services/aiProvider.js`) sends every AI request through a
small provider layer. It tries providers in order and only falls through on rate
limits (429), server errors (5xx) or network/timeout failures:

1. **Groq** (`GROQ_API_KEY`, `GROQ_MODEL`) — primary, fastest.
2. **Gemini** (`GEMINI_API_KEY`, `GEMINI_MODEL`) — free fallback via Google's
   OpenAI-compatible endpoint.

Providers without an API key are skipped, so the app still works with a Groq-only
setup. The free tiers together cover roughly 200–300 students/day at normal
question counts; if a spike needs more headroom, moving the Groq key to a paid
plan is a one-line `.env` change. Adding another provider (e.g. DeepSeek, Ollama)
is just another entry in the list in `aiProvider.js`.

Notes:
- Gemini's free tier is capped around 1,500 requests/day per project, and Google
  may use free-tier prompts to improve products — switch to paid Gemini if that
  matters for your data.
- You can verify failover by temporarily removing `GROQ_API_KEY` and running an
  interview — it should complete via Gemini.

## Known gotchas

- **Class names are hardcoded** in two places and must stay in sync:
  - `frontend/src/constants.js` (`CLASSES`)
  - `backend/server.js` (`CLASSES`)
  If the college uses different class names, update both. They drive the syllabus setup, Excel upload, and AI difficulty guidance.
- **Groq API key is mandatory** — no interviews without it. A Gemini key is recommended as a free fallback but optional.
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
