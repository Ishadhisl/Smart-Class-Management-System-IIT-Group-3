# Deployment Plan — Render (one Docker service) + Vercel (Frontend) + Neon (DB)

> **Revision note:** an earlier version of this plan split the backend and AI service into
> two separate Render services. **That doesn't work with this codebase** —
> `fastapi_service/main.py`'s `/encode` and `/verify` endpoints resolve image/video paths as
> `../thusitha-backend/<path>` (plain filesystem traversal), which only exists if both
> processes share one disk. Two separate Render services never share a filesystem, so every
> face-encoding/attendance call would fail with a file-not-found error. §0 explains this in
> full; the fix is **one combined Docker service** running Node + Python together, which is
> what this plan now does. It needs one Dockerfile ([`Dockerfile`](../Dockerfile), already
> added to the repo) but still no SSH, no VPS, no manual server admin — just one Render
> dashboard entry with "Runtime: Docker" instead of "Runtime: Node".
>
> Moodle stays **local-only** (XAMPP, not deployed) — not a core assessed flow, not worth the
> extra cost/complexity of a third service.
>
> **Cost strategy:** Render bills compute per second, not a flat monthly fee. Stay on **Free**
> while building/testing (sleep-on-idle doesn't matter — you're the only one hitting it). Flip
> to **paid** only for the final few days before + during the viva, then flip back right
> after. See §7.

---

## 0. Why one Docker service, not two — and what still needs your attention

**The filesystem-sharing problem (fixed by this plan):**

| Endpoint | What it does | Why it needs a shared disk |
|---|---|---|
| `POST /encode` (`fastapi_service/main.py:621`) | `abs_path = os.path.join("..", "thusitha-backend", req.image_path)` then reads that file | Node sends a *path string*, not the image bytes — the AI process must be able to read that path itself |
| `POST /verify` (`main.py:396`) | Same pattern for `zone.camera_url` when it's a local video file, and saves suspicious-frame snapshots to `../thusitha-backend/uploads/suspicious/` | Same — reads and writes through a path relative to `thusitha-backend/` |

Running both processes in **one container** (this plan's `Dockerfile`) means `../thusitha-backend`
resolves correctly because it's genuinely the sibling folder on the same disk — exactly like
local dev, and exactly like the original `provision.sh`-based single-VPS plan assumed. The
existing `checkAndStartAIServer()` in `server.js` already spawns `python fastapi_service/main.py`
as a child process when nothing answers on `:8000` — the Dockerfile just makes sure a working
`python` (with all AI deps installed) exists in the same container, so that mechanism works
completely unmodified. No code changes, no second Render service, and `FASTAPI_URL` doesn't
even need to be set (the code already defaults to `http://localhost:8000`, which is correct
here since both processes share one container).

**A separate issue this plan does *not* fix — read before demo day:**

`camera_url` (`Camera_Zones` table, set per hall/zone by an admin) can be a webcam device
index (e.g. `"0"`), a network stream URL, or a local video file path. **A device index only
works if there's a physical camera attached to the machine running the AI process.** Render's
servers have no camera hardware — if your current zones are configured with `"0"` (laptop
webcam, likely how local testing is set up), **live face-recognition attendance will not
capture anything once hosted**, regardless of RAM or instance type. This isn't something
hosting can fix. Options for the hosted deployment:
- Set the zone's `camera_url` to a **pre-recorded video file** uploaded to the persistent
  disk (§4) — works reliably from any host, good enough for a demo
- Or keep the **live-webcam scenario as a local-only** part of the demo (same pattern as the
  WhatsApp/AI local-fallback discussed earlier), and use the hosted link for everything else

---

## 1. Architecture

```
┌──────────┐   HTTPS    ┌───────────────────────────────┐        ┌──────────────────┐
│  Vercel    │───────────▶  Render: scms-backend (Docker)  │───────▶  Neon PostgreSQL   │
│  frontend  │◀───────────  Node (server.js) + Python       │        │  (free tier)       │
└──────────┘            │  (fastapi_service, spawned on     │        └──────────────────┘
                         │   :8000 by server.js itself)      │
                         │  + persistent disk (uploads,      │
                         │    WhatsApp session)              │
                         └───────────────────────────────┘

Moodle: local XAMPP only, not part of this deployment.
```

---

## 2. Code changes this plan needs (already applied in this repo)

1. **`thusitha-backend/db.js`** — supports `DATABASE_URL` (Neon connection string) with SSL
   automatic, falls back to discrete `DB_*` vars for local dev.
2. **`database/schema.sql`** — fixed (was previously wrapped in a no-op comment block).
3. **`OTP_Store` table** — added to `schema.sql` §12 and as `database/migration_otp_store.sql`.
4. **`QRAttendanceTab.jsx`** — public-domain-aware QR target URL.
5. **`Dockerfile`** / **`.dockerignore`** (repo root) — combined Node + Python image; see §0.

One change **not yet applied**, do it only if needed (§3 explains when):

- **`fastapi_service/main.py:15`** — currently `YOLO("yolov8m.pt")`. If the combined service
  OOMs on Standard (2GB), change this to `YOLO("yolov8n.pt")` (nano model — smaller memory
  footprint, slightly less accurate headcount overlay) and redeploy.

---

## 3. Push to GitHub

```bash
git add .
git commit -m "Deploy commit"
git push <remote> <branch>
```
(Which remote/branch — `origin` vs your own fork — is still your call; fill in before running.)

---

## 4. Backend + AI on Render (one Docker service, paid + persistent disk)

1. [render.com](https://render.com) → **New + → Web Service** → select the repo.
2. Settings:
   - **Name:** `scms-backend`
   - **Runtime:** **Docker**
   - **Dockerfile Path:** `Smart Class Manegemnt System/Dockerfile`
   - **Docker Build Context Directory:** `Smart Class Manegemnt System`
   - **Instance Type:** start on **Free** while testing (build will still take a while the
     first time — `pip install` compiles `dlib` from source, expect 10-20 min). Switch to
     **Standard ($25/mo, billed per second)** a few days before the demo — Node + Python +
     dlib + YOLOv8/torch together need more than the 512MB Starter plan gives; try Standard
     first, and only reach for `yolov8n.pt` (§2) or Pro ($85/mo) if you still see OOM kills in
     the logs under real load.
3. **Disk** (this service → Disks → Add Disk) — **only available on a paid instance type**:
   - **Mount Path:** `/app/thusitha-backend/uploads` (fixed by the `Dockerfile`'s `WORKDIR
     /app/thusitha-backend` + `CMD ["node", "server.js"]` — `process.cwd()` is always this
     path in this image, no need to guess via `pwd` here)
   - **Size:** 3GB is plenty for photos, exam Excel exports, and the WhatsApp Baileys session
     folder
4. Environment variables:
   ```
   DATABASE_URL   = <Neon connection string, §5>
   NODE_ENV       = production
   PORT           = 5000
   JWT_SECRET     = <generate: openssl rand -base64 48>
   FRONTEND_URL   = https://your-project.vercel.app   (exact origin, no trailing slash — CORS in server.js checks this exactly)
   QR_EXPIRY_MINUTES = 15
   ```
   `FASTAPI_URL` is **not needed** — it defaults to `http://localhost:8000`, which is correct
   here (§0). Leave `TWILIO_*`, `MOODLE_*` unset.
5. Deploy. Note the URL (`https://scms-backend-xxxx.onrender.com`).
6. Once it's up, check the **Logs** tab for `AI Server is already running on port 8000` (or
   the startup line from `fastapi_service`) to confirm the Python side actually came up inside
   the container — if you instead see repeated `Failed to start AI Python server: ENOENT`,
   the image's `python` isn't resolving; re-check the Dockerfile's venv `PATH` step.

---

## 5. Free PostgreSQL — Neon.tech

1. [neon.tech](https://neon.tech) → sign up with GitHub → **Create Project** (`scms-db`).
2. Copy the connection string (`postgres://user:password@ep-xyz.neon.tech/neondb?sslmode=require`) → this is `DATABASE_URL` in §4.
3. Neon dashboard → **SQL Editor** → run, in order:
   - `database/schema.sql` (includes `OTP_Store`)
   - `database/migration_phase2.sql`
   - `database/migration_qr_attendance.sql`
   - `database/migration_2026_06_19_promotions_teacher_profile_photo.sql`

---

## 6. Frontend on Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
2. Settings:
   - **Root Directory:** `Smart Class Manegemnt System/thusitha-frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Environment variable: `VITE_API_URL = https://scms-backend-xxxx.onrender.com` (§4's URL).
4. Deploy, then **redeploy once more** after setting the env var (Vercel only bakes env vars
   into the build that runs after they're saved).
5. Once you have the real Vercel URL, go back to §4 and update `FRONTEND_URL` to match
   exactly, then redeploy the backend (CORS will reject requests otherwise).

---

## 7. Cost-control checklist

- [ ] Build and test on the **Free** instance type first — no cost, sleep doesn't matter while
      you're the only user
- [ ] A few days before the viva: switch `scms-backend` to **Standard** (§4)
- [ ] Link WhatsApp (scan the QR from the **Logs** tab) *after* switching to paid, so the
      session lands on the persistent disk, not about to be wiped
- [ ] Upload a demo video file to the disk and point a `Camera_Zones` row at it (§0) if you
      want AI attendance to work through the hosted link
- [ ] Run the full testing checklist below at least once before the actual viva
- [ ] **Right after the viva:** switch back to Free, or delete the service — billing is
      per-second, nothing is owed for time not running

---

## 8. Testing checklist

- [ ] `https://your-project.vercel.app` loads, login works (confirms CORS + DB connection)
- [ ] Students/Teachers/Payments/Exams/Reports tabs — CRUD works
- [ ] File upload (student photo, exam Excel) — survives a manual redeploy of the backend
      (proves the disk is actually mounted, not the ephemeral default)
- [ ] Forgot Password / WhatsApp OTP — message actually arrives
- [ ] AI face-recognition attendance — generate a face encoding, run an attendance session
      against the demo video (§0/§7), confirm a match (not just that the endpoint responds)
- [ ] Materials/Timetable tab — expect this to have nothing to show (Moodle is local-only in
      this plan); hide the tab or show a "coming soon" state for the deployed link
- [ ] QR attendance — scan from a phone on a different network (e.g. mobile data)

---

## 9. Security notes

- Never commit `.env` — set `DATABASE_URL`/`JWT_SECRET` via Render's and Neon's dashboards.
- Generate a fresh `JWT_SECRET` for this deployment; don't reuse your local `.env`'s value.
- `STRIPE_SECRET_KEY`, if you set one, should stay in test mode unless you intend to accept
  real payments through this deployment.
