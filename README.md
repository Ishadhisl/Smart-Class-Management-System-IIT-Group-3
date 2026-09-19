# Smart Class Management System (SCMS) — Thusitha Smart Academy

A classroom management platform for a Sri Lankan tutoring institute: student/teacher records, QR-based attendance with AI-assisted CCTV headcount and face verification, payments (bank receipt + Stripe), exams, learning materials, promotions, and SMS/WhatsApp notifications — integrated with a Moodle LMS for course content and enrollment sync.

This document reflects the codebase directly (routes, controllers, `.env.example`, `package.json`, `vite.config.js`, `create_tables.js`/`import_database.js`) as of **August 2026**. Older docs in this repo (`QUICK_START.md`, `SETUP_REQUIREMENTS.md`, the previous `README.md`) reference a Docker setup, package versions, and URLs that no longer match the actual code — this file supersedes them for local setup.

---

## 1. Architecture

Five moving pieces, two databases:

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  https://localhost:5173  (React 19 + Vite SPA)                   │
└───────────────┬─────────────────────────────────┬────────────────┘
                │ REST (axios)                     │ same-origin proxy
                ▼                                  ▼
┌───────────────────────────────┐   ┌─────────────────────────────┐
│ thusitha-backend               │   │ Moodle (PHP, under XAMPP)    │
│ Node/Express — https://:5000   │◄──┤ course content, enrollment   │
│ talks to Postgres directly     │   │ http://localhost/moodle      │
└───────────┬─────────────┬──────┘   └──────────────┬────────────────┘
            │             │ auto-spawns              │
            ▼             ▼                          ▼
  ┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────┐
  │ PostgreSQL         │  │ fastapi_service       │  │ MySQL/MariaDB    │
  │ thusithaedu_db     │  │ Python — :8000         │  │ (Moodle's own DB, │
  │ app data           │  │ face recognition +     │  │ via XAMPP)        │
  │                    │  │ YOLOv8 headcount        │  │                  │
  └──────────────────┘  └─────────────────────┘  └─────────────────┘
```

- **Two databases, two different systems.** PostgreSQL holds everything this app owns (students, payments, attendance, exams). Moodle is a separate third-party LMS with its own MySQL/MariaDB database — the backend never touches Moodle's DB directly, only its REST web-service API (`utils/moodleService.js`).
- **The AI service isn't started manually.** `thusitha-backend/server.js`'s `checkAndStartAIServer()` spawns `python fastapi_service/main.py` automatically on backend startup if nothing is already listening on port 8000.
- **The dev frontend/backend both run over HTTPS**, using a self-signed cert pair at `certs/dev-*.pem` — required because webcam access (`navigator.mediaDevices`, used for live face verification) only works in a secure browser context.

---

## 2. Prerequisites — exact versions

Checked against each project's official site on **2026-08-13/14**. Pick the version in **bold**; alternatives are also fine.

| Tool | Recommended | Also fine | Download | Why this one |
|---|---|---|---|---|
| **Node.js** | **v24.19.0** (LTS "Krypton") | v22.23.2 (LTS "Jod") | [nodejs.org](https://nodejs.org/) | **Not v20** — Node 20 ("Iron") reached end-of-life on **2026-03-24**, so it no longer receives security patches even though older docs (including earlier versions of this one) recommended it. |
| **npm** | bundled with Node | — | — | Installed automatically with Node.js above. |
| **Python** | **3.12.14** | 3.11.16 | [python.org](https://www.python.org/downloads/) | For `fastapi_service`. Tick **"Add Python to PATH"** during install. Avoid anything newer than 3.12 for now — `dlib`/`face-recognition` (used for face encoding) are slow to get prebuilt wheels for brand-new Python releases, which risks a failed/very slow build from source. |
| **PostgreSQL** | **16.15** | 15.19, 17.11, 18.6 | [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) | Any recent version works — the schema uses no version-specific features. 16.x is a safe, mature default. |
| **XAMPP** | **8.2.12** (bundles PHP 8.2.12) | 8.1.25 (PHP 8.1.25) | [apachefriends.org](https://www.apachefriends.org/download.html) | Only needed if you're also restoring/running Moodle locally. Moodle 4.5 (this project's LMS version — see `moodle/version.php`) needs PHP in the 8.1–8.3 range; 8.2 sits safely in the middle. |
| **Visual Studio Build Tools** | **2022**, "Desktop development with C++" workload | — | [visualstudio.microsoft.com/downloads](https://visualstudio.microsoft.com/downloads/) | Windows only. Compiles `dlib` from source for face recognition. **Restart your PC after installing.** |
| **Git** | any recent version | — | [git-scm.com](https://git-scm.com/) | For cloning the repo. |

### Verify after installing
```powershell
node -v
npm -v
python --version
psql --version
git --version
```

---

## 3. Project structure

```
Smart Class Manegemnt System/
├── certs/                       # Dev HTTPS cert pair — REQUIRED, see §5
│   ├── dev-cert.pem
│   └── dev-key.pem
├── database/                    # SQL schema + migration files, applied manually
│   ├── schema.sql
│   ├── migration_phase2.sql
│   ├── migration_qr_attendance.sql
│   └── migration_2026_06_19_promotions_teacher_profile_photo.sql
├── deploy/                      # Deployment guides + scripts — see deploy/DEPLOY.md
├── thusitha-backend/            # Node/Express API — port 5000
│   ├── .env.example
│   ├── server.js
│   ├── create_tables.js         # Idempotent CREATE TABLE IF NOT EXISTS
│   ├── import_database.js       # Creates DB + runs schema.sql + migration_phase2.sql + seeds test data
│   ├── seed_srilankan_data.js
│   ├── routes/  controllers/  middleware/  utils/
│   └── uploads/                 # Student/teacher photos, receipts, materials (gitignored, kept via .gitkeep)
├── thusitha-frontend/           # React 19 + Vite SPA — port 5173
│   ├── vite.config.js           # Hardcoded HTTPS, Moodle same-origin proxy
│   └── src/
├── fastapi_service/              # Python FastAPI — port 8000, AI/CV
│   ├── requirements.txt
│   └── main.py
└── moodle/  moodledata/          # Pre-configured Moodle LMS (restore into XAMPP's htdocs)
```

**Not in this repo, despite what older docs say:** there is no `docker-compose.yml` or `Dockerfile` in this project — ignore any Docker instructions in `QUICK_START.md`/`DOCKER_GUIDE.md`.

---

## 4. Setup, step by step

### 4.1 Get the code
```bash
git clone <repo-url> scms
cd scms
```
If you received this as a **zip** instead of a git clone, extract it and confirm you have `thusitha-backend/`, `thusitha-frontend/`, `fastapi_service/`, **and** `certs/` — the zip should include `certs/` since it's a raw folder copy, but git clones will not (see §5).

### 4.2 Install Node dependencies
```bash
cd thusitha-backend && npm install
cd ../thusitha-frontend && npm install
```
Skipping this makes every later step fail — `import_database.js` needs the `pg` package, and `npm start`/`npm run dev` need their respective frameworks installed.

### 4.3 Set up the dev HTTPS certificates

`*.pem` files are gitignored (see `.gitignore`), so a fresh `git clone` will **not** include `certs/dev-cert.pem`/`dev-key.pem` even though `vite.config.js` and `server.js` expect them. Two paths:

- **You got a zip that already includes `certs/`:** nothing to do.
- **You cloned via git and `certs/` is missing or empty:** generate your own with [mkcert](https://github.com/FiloSottile/mkcert):
  ```powershell
  winget install FiloSottile.mkcert
  mkcert -install
  mkdir certs
  mkcert -key-file certs/dev-key.pem -cert-file certs/dev-cert.pem localhost 127.0.0.1 ::1
  ```
  Without this, `npm run dev` in the frontend crashes on startup (`vite.config.js` reads these files with no fallback). The backend degrades more gracefully — it falls back to plain HTTP if the certs are missing — but then it no longer matches the frontend's HTTPS scheme, which breaks webcam-dependent features.

### 4.4 Configure the backend `.env`

```bash
cd thusitha-backend
cp .env.example .env
```

**Edit `.env` and change these two lines** — the defaults in `.env.example` (`DB_NAME=smartclass_db`, `DB_PASSWORD=password123`) do **not** match the database name this project's own scripts and migration files expect:

```env
DB_PASSWORD=Thusitha@2026
DB_NAME=thusithaedu_db
```
(`DB_USER=smartclass` is already correct in the example — no change needed there.)

Also fill in, if you'll use these features:
| Variable | Notes |
|---|---|
| `JWT_SECRET` | Any long random string for local dev |
| `FRONTEND_URL` | Not in `.env.example` but read by `server.js`'s CORS check — set to `https://localhost:5173` |
| `STRIPE_SECRET_KEY` | Test-mode key from your Stripe dashboard, if testing payments |
| `MOODLE_URL` / `MOODLE_TOKEN` | Only needed if running Moodle locally too — see §4.7 |
| `TWILIO_*` | Only needed for SMS testing |

### 4.5 Create the PostgreSQL role (if it doesn't already exist)
```sql
psql -U postgres
CREATE USER smartclass WITH PASSWORD 'Thusitha@2026';
ALTER USER smartclass CREATEDB;
\q
```

### 4.6 Create the database and apply all migrations

From `thusitha-backend/`:
```bash
node import_database.js
```
This creates `thusithaedu_db` if it doesn't exist, runs `database/schema.sql`, runs `database/migration_phase2.sql`, and seeds sample test data via `seed_srilankan_data.js`.

**It does not apply the other two migration files** — run these manually right after, or QR attendance and teacher/promo photo columns will be missing:
```bash
psql -U smartclass -d thusithaedu_db -f ../database/migration_qr_attendance.sql
psql -U smartclass -d thusithaedu_db -f ../database/migration_2026_06_19_promotions_teacher_profile_photo.sql
```

### 4.7 (Optional) Restore Moodle locally

Only needed if you're testing Moodle-integrated features (course sync, SSO). See `moodle_setup.md` for the full restore procedure — in short: install XAMPP (§2), copy `moodle/` into XAMPP's `htdocs/`, copy `moodledata/` alongside it, and restore the provided `database/moodle.backup` into XAMPP's MySQL. The restored install already has its web-service token configured — put that token in the backend's `MOODLE_TOKEN`.

### 4.8 Set up the AI microservice
```bash
cd ../fastapi_service
python -m venv venv
.\venv\Scripts\activate        # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```
Expect **10–20 minutes** — `dlib` compiles from C++ source. This is why Visual Studio Build Tools (§2) has to be installed first.

You don't need to run this service yourself — the backend auto-launches `python fastapi_service/main.py` on startup (§1). Only run it directly (`python main.py`) if you're debugging the AI pipeline and want to see its logs live.

---

## 5. Running the project

Two terminals:

**Terminal 1 — backend**
```bash
cd thusitha-backend
npm start
```
Wait for:
```
✅ Database Connection Pool established
🚀 Server is running on https://localhost:5000
```

**Terminal 2 — frontend**
```bash
cd thusitha-frontend
npm run dev
```

**Open the app:** `https://localhost:5173` — **not** `http://`. The dev server only speaks TLS (self-signed cert from §4.3); plain HTTP won't connect. Your browser will show a "connection not private" warning on first visit — that's expected for a self-signed dev certificate. Click **Advanced → Proceed to localhost**.

To stop either process: `Ctrl+C` in its terminal.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot find module 'pg'` (or similar) | Skipped §4.2 | Run `npm install` in `thusitha-backend`/`thusitha-frontend` |
| Frontend crashes on `npm run dev` with an `ENOENT` on a `.pem` file | Missing `certs/` folder | See §4.3 |
| `psql: FATAL: database "thusithaedu_db" does not exist` when running the migration commands | `.env` still has `DB_NAME=smartclass_db`, or §4.6's `node import_database.js` wasn't run first | Fix `.env` (§4.4), re-run in order |
| Browser can't reach `http://localhost:5173` | Wrong scheme | Use `https://localhost:5173` |
| `EADDRINUSE :::5000` or `:::5173` | Another instance (yours or a teammate's) already running | Close the other process, or change `PORT` in `.env` |
| `pip install -r requirements.txt` fails compiling `dlib` | Visual Studio Build Tools not installed, or PC not restarted after | Install the "Desktop development with C++" workload (§2), restart, retry |
| QR attendance or teacher/promo photo uploads error out | The two extra migration files from §4.6 weren't applied | Run the two `psql -f` commands in §4.6 |

---

## 7. Production deployment

This README covers **local development only**. For hosting a real deployment, see
`deploy/DEPLOY.md` — this project's plan: Neon/Render Postgres + Render backend + Vercel
frontend, all free managed tiers, zero server admin. Read its "why this plan is limited"
section before deploying — WhatsApp OTP and AI face-recognition attendance don't survive
Render's free tier reliably (need a local run for a live demo of those two specifically),
and the Materials/Timetable tab has no Moodle host in this plan.

---

## 8. Security notes (before any real deployment)

- Never commit `.env` — it's gitignored, keep it that way.
- Generate a fresh, long `JWT_SECRET` — don't reuse the local-dev one.
- Use a real, non-default PostgreSQL password in production, not `Thusitha@2026`.
- The dev HTTPS cert in `certs/` is self-signed and **only** for local development — production (`deploy/DEPLOY.md`) gets HTTPS from Render/Vercel automatically instead.
- Switch `STRIPE_SECRET_KEY` to a live-mode key only when actually ready to accept real payments.
