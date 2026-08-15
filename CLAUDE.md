# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This directory (`Smart Class Manegemnt System/`, note the intentional typo in the folder name) is the actual project and its own git repo (remote: `Priyasad010/Smart-Class-Management-System`, checked out on branch `Upeksha`). It sits several levels deep under a much larger, non-project parent folder (`D:\Smart class Management System NEW\`) that also contains an unrelated vendored **Moodle** source tree (`moodle/`), a `moodledata/` folder, SQL dumps, and a `Team_Tasks/` folder with per-teammate zips of older backend/frontend copies — none of that is part of this project; ignore it unless a task explicitly points there. Always run commands from inside `Smart Class Manegemnt System/`, `thusitha-backend/`, or `thusitha-frontend/` as appropriate, not from the grandparent folders.

The system has three runtime components:
- **`thusitha-backend/`** — Node/Express API (port 5000), talks to PostgreSQL directly via `pg` (no ORM), and to a separately-hosted Moodle LMS instance over its REST web service API.
- **`thusitha-frontend/`** — React 19 + Vite SPA (port 5173), Tailwind v4.
- **`fastapi_service/`** — Python FastAPI microservice (port 8000) doing the CV/AI heavy lifting (face recognition, YOLOv8 headcount). The backend auto-spawns this as a child process on startup if it isn't already listening on port 8000 (see `checkAndStartAIServer` in `server.js`), so it doesn't need to be started manually during normal dev — but if you're debugging the AI pipeline itself, running `python fastapi_service/main.py` directly gives better visibility into its logs.

A pre-configured Moodle LMS (PHP, under XAMPP) acts as the external LMS the backend syncs to for course enrollment/materials; see `moodle_setup.md` for how it's wired up (backend talks to it purely via `MOODLE_URL`/`MOODLE_TOKEN` REST calls in `thusitha-backend/utils/moodleService.js` — you generally don't need to touch the Moodle codebase itself).

## Commands

### Backend (`thusitha-backend/`)
```bash
npm start              # run server (node server.js)
npm run dev             # run with nodemon (auto-restart)
npm test                 # run full Jest suite (NODE_ENV=test)
npm run test:unit        # tests/unit only
npm run test:system      # tests/system only (supertest-based API tests)
npm run test:usecase      # tests/usecases only
npx jest tests/unit/payment.test.js         # run a single test file
npx jest -t "some test name"                # run tests matching a name
```
`@whiskeysockets/baileys` (WhatsApp) is mocked in tests via `tests/mocks/baileysMock.js` (wired through the `jest.moduleNameMapper` in `package.json`) since it requires a live WhatsApp session.

### Frontend (`thusitha-frontend/`)
```bash
npm run dev       # Vite dev server (--host, so it's reachable on LAN — needed for phone QR scanning flows)
npm run build      # production build
npm run lint       # ESLint
npm run preview     # preview a production build
```
There is no frontend test runner configured.

### AI microservice (`fastapi_service/`)
```bash
pip install -r requirements.txt
python main.py     # runs uvicorn on port 8000
```
Requires a C++ build toolchain (dlib/face-recognition compiles native extensions) — see `QUICK_START.md` if setup fails on Windows.

### First-time environment setup
```bash
cp thusitha-backend/.env.example thusitha-backend/.env
cp thusitha-frontend/.env.example thusitha-frontend/.env
```
Then fill in DB credentials etc. PostgreSQL database must be created manually (no migration runner) — see `DATABASE.md`. Table creation scripts live in `thusitha-backend/create_tables.js`, `thusitha-backend/utils/schema.sql`, and `database/*.sql` (numbered/named migration files, applied manually — there's no migration framework, so check `database/` for the latest schema state before assuming a column exists).

## Architecture

### Backend: routes → controllers → raw SQL
Standard Express layering, one route/controller pair per domain (`achievements`, `attendance`, `payments`, `students`, `moodle-sso`, `qr-attendance`, etc. — see the full mount list in `server.js`). Controllers query PostgreSQL directly with parameterized queries via `db.pool.query(...)` (`db.js`) — there is no ORM/query builder, so schema knowledge has to come from `database/schema.sql` / migration files rather than model definitions.

Auth is JWT-based (`middleware/authMiddleware.js`): `verifyToken` populates `req.user = { userId, role, username }`, and `checkRole([...roles])` gates routes by role (roles include `Admin`, `Counter Person`, `Teacher`, plus student/parent-facing public routes). Role names are matched case-insensitively. Many role-check failure messages are user-facing and written in Sinhala — that's intentional (this app serves a Sri Lankan tutoring institute), not a bug; match that convention when adding new user-facing error strings in controllers.

Several controllers integrate outward to third-party services inline (not via a queue): Moodle account/enrollment sync (`utils/moodleService.js`), Twilio/WhatsApp SMS (`utils/smsService.js`, `utils/whatsappService.js`, backed by `@whiskeysockets/baileys`), Stripe payments, and the FastAPI AI service (`attendanceController.runAIProcess`, called by other controllers like `studentController.generateFaceEncoding`). These calls are wrapped in try/catch that logs and degrades gracefully (e.g. Moodle sync failing doesn't block student registration) rather than failing the whole request — follow that pattern for new integrations.

Scheduled/background work goes through `utils/cronJobs.js` (`node-cron`), initialized once in `server.js`.

### AI/CV pipeline (`fastapi_service/main.py`)
Dual-engine face detection (dlib HOG + MediaPipe, merged via IoU) feeding a temporal verification algorithm: samples ~15 frames from a video/CCTV source, locks face "seats" from a representative frame, crops all frames per seat, generates dlib 128D encodings, and matches against precomputed student encodings (stored as JSONB in `students.face_encoding`) via Euclidean distance with a 0.45 threshold. YOLOv8 (`yolov8m.pt`/`yolov8n.pt`) does separate headcount/body-box overlay for audit purposes, applied only *after* face crops are extracted so overlay boxes never contaminate what gets encoded. Full write-up: `ai_implementation_explanation.md`.

### Frontend: single tab-switching dashboard, not route-per-feature
`react-router-dom` only distinguishes a handful of top-level routes (landing page, `/login`, `/dashboard/*`, public course/teacher discovery pages, QR verification for students). Once inside `/dashboard`, `pages/Dashboard/Dashboard.jsx` owns an `activeTab` state string and conditionally renders one of ~25 tab components from `components/Dashboard/*Tab.jsx` (Students, Teachers, Attendance, Payments, Exams, Study Area, Materials, Promotions, Audit Log, Settings, etc.), each gated by role flags (`isAdmin`, `isAdminOrCounterPerson`, ...) computed from the logged-in user. When adding a new dashboard feature, add a new `*Tab.jsx` component plus a case in `Dashboard.jsx` and an entry in `components/Dashboard/Sidebar.jsx`, rather than a new route.

API calls go through `services/*Service.js` wrapping a shared `services/api.js` axios client; `VITE_API_URL` (from `.env`) points it at the backend.

### Key domain flows worth knowing before changing related code
- **QR attendance**: `qrAttendanceController`/`qrAttendanceRoutes` + `QRVerifyPage` — students scan a per-session QR (backend generates a short-lived token, `QR_EXPIRY_MINUTES` env var) which opens `/attendance/verify/:sessionId` on their own phone; `server.js`'s `/api/system/ip` endpoint exists specifically so the frontend can build a LAN-reachable URL for that QR code (admin machine keeps using `localhost` for webcam access, phones need the real LAN IP).
- **Moodle sync**: enrollment/payment/course changes in this system push corresponding changes to Moodle via `moodleService.js` and `sync_to_moodle.js`/`sync_users_to_moodle.js` (one-off sync scripts, not run automatically).
- **Face encoding lifecycle**: a student's profile photo → `generateFaceEncoding`/`bulkGenerateEncodings` in `studentController.js` calls the FastAPI `/encode` endpoint → 128D vector stored in `students.face_encoding` → later compared during live attendance sessions.
