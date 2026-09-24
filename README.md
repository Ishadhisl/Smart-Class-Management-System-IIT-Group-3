<div align="center">

# 🎓 Smart Class Management System (SCMS)

**An AI-powered class management platform for a real tutoring institute in Sri Lanka — with 3-layer, proxy-proof attendance.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-scms--frontend--lac.vercel.app-4f46e5?style=for-the-badge&logo=vercel)](https://scms-frontend-lac.vercel.app)

![React](https://img.shields.io/badge/React_19-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![YOLOv8](https://img.shields.io/badge/YOLOv8-111F68?style=flat&logo=ultralytics&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat&logo=opencv&logoColor=white)
![Moodle](https://img.shields.io/badge/Moodle-F98012?style=flat&logo=moodle&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=flat&logo=jest&logoColor=white)

</div>

---

## 📖 About

**SCMS** was built for **Thusitha Academy**, a tutoring institute in Sri Lanka. It replaces paper attendance registers, manual fee tracking and phone calls to parents with one web platform for **admins, teachers, counter staff, students and parents**.

Tutoring classes often have 100+ students, and "proxy" attendance (a friend scanning or signing for an absent student) is a real problem. So we made attendance the heart of the system and **verified it with AI**.

> 🧑‍💻 Group project: 3rd year, 2nd semester (3.2) · Industrial Information Technology · Uva Wellassa University of Sri Lanka

---

## ✨ Our novelty: 3-layer AI-verified attendance

```mermaid
flowchart LR
    A["📱 1. QR Attendance<br/>Students scan a live,<br/>session-specific QR code"] --> B["🎥 2. AI CCTV Headcount<br/>YOLOv8 counts the people<br/>actually in the classroom"]
    B --> C{"QR count<br/>= AI count?"}
    C -- "✅ Match" --> D["Attendance confirmed"]
    C -- "⚠️ Mismatch" --> E["🙂 3. Face Verification<br/>Teacher verifies suspected<br/>students via live webcam"]
    E --> D
```

1. **QR attendance:** each class session gets a time-limited QR code. Students scan it with their phone camera.
2. **AI CCTV headcount:** a CCTV image or video of the classroom goes to our Python AI service. **YOLOv8** detects every person, while a dual-engine face detector (**dlib HOG + MediaPipe**, merged by IoU) finds each face — matched across 15 sampled video frames so a blink or head turn doesn't cause a false result.
3. **Mismatch → face verification:** if the number of QR scans doesn't match the number of people the AI counted, the system raises an alert. The teacher can then verify students one by one with **live face recognition** (128-D dlib face encodings, Euclidean distance < 0.45, matched against each student's enrolled face profile).

**Result:** no more proxy attendance, and teachers can trust the numbers.

<div align="center">
  <img src="docs/screenshots/demo-ai-attendance.gif" alt="Demo: AI detects a mismatch between QR scans and headcount, then face verification confirms the student" width="760"/>
  <br/><sub>AI detects a mismatch (1 QR scan vs 4 people in class), then face verification confirms the student</sub>
</div>

📄 Technical deep-dive: [`ai_implementation_explanation.md`](ai_implementation_explanation.md)

---

## 🧩 Features

| Area | What it does |
|---|---|
| 🧑‍🎓 **Students & Teachers** | Registration, profiles, QR ID cards, face-encoding enrolment, class enrolment |
| ✅ **Attendance** | QR attendance, AI CCTV headcount, mismatch alerts, face verification, validation reports |
| 💳 **Payments** | Online payments via **PayHere**, bank-receipt upload & approval, fee reminders |
| 📚 **Learning (Moodle LMS)** | Course materials, enrolment sync and single sign-on with Moodle |
| 📝 **Exams & Timetables** | Exam management, results, class timetables, study area with countdowns |
| 👨‍👩‍👧 **Parent Portal** | Parents follow their child's attendance, payments and results |
| 🔔 **Notifications** | Automated WhatsApp alerts to parents (attendance, payments, reminders) with message logs |
| 📣 **Promotions & Achievements** | Institute promotions and student achievements on the public landing page |
| 🔐 **Security** | JWT auth, role-based access (Admin, Teacher, Counter Person, Student, Parent), login lockout, OTP, audit logs |

The UI is in **Sinhala and English**, made for the institute's staff and students.

---

## 📸 Screenshots

| Admin Dashboard | QR Attendance |
|:---:|:---:|
| <img src="docs/screenshots/01-dashboard.png" alt="Admin dashboard" width="420"/> | <img src="docs/screenshots/02-qr-attendance.png" alt="QR attendance" width="420"/> |
| **AI Mismatch Alert** | **CCTV Analysis** |
| <img src="docs/screenshots/03-ai-mismatch.png" alt="AI mismatch alert" width="420"/> | <img src="docs/screenshots/04-cctv-analysis.png" alt="CCTV analysis" width="420"/> |
| **Face Verification** | **Identity Verified** |
| <img src="docs/screenshots/05-face-verification.png" alt="Face verification" width="420"/> | <img src="docs/screenshots/06-verified.png" alt="Identity verified" width="420"/> |

---

## 🏗️ Architecture

```mermaid
flowchart TB
    U["🌐 Browser<br/>React 19 + Vite SPA"] -->|REST / JWT| B["⚙️ Node.js / Express API"]
    B -->|SQL| P[("🐘 PostgreSQL")]
    B -->|HTTP| AI["🤖 Python FastAPI<br/>YOLOv8 · dlib · MediaPipe · OpenCV"]
    B -->|REST web services| M["📚 Moodle LMS"]
    B --> PH["💳 PayHere"]
    B --> N["🔔 WhatsApp"]
```

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS 4, Axios |
| **Backend** | Node.js, Express, JWT, raw parameterised SQL (`pg`) |
| **AI service** | Python, FastAPI, YOLOv8 (Ultralytics), dlib `face_recognition`, MediaPipe, OpenCV |
| **Database** | PostgreSQL |
| **Integrations** | Moodle LMS, PayHere, WhatsApp (Baileys) |
| **Testing** | Jest + Supertest (unit, system and use-case tests) |
| **Deployment** | Vercel (frontend) · Render + Docker (backend + AI) · Neon (PostgreSQL) |

---

## 🚀 Getting started

**You'll need:** Node.js 22/24, Python 3.12, PostgreSQL 16, and (on Windows) Visual Studio Build Tools for `dlib`.

```bash
git clone https://github.com/Ishadhisl/Smart-Class-Management-System-IIT-Group-3.git
cd Smart-Class-Management-System-IIT-Group-3

# Backend (also auto-starts the Python AI service)
cd thusitha-backend
cp .env.example .env        # then fill in DB credentials, JWT secret, etc.
npm install
node import_database.js     # creates the database + sample data
npm start

# Frontend (in a second terminal)
cd thusitha-frontend
npm install
npm run dev                 # open https://localhost:5173
```

📘 Full step-by-step guide (HTTPS certificates, migrations, Moodle, troubleshooting): **[`docs/SETUP.md`](docs/SETUP.md)**

### More documentation
- 🤖 [AI attendance subsystem](ai_implementation_explanation.md)
- 🗄️ [Database](DATABASE.md)
- 🔐 [Security measures](SECURITY.md)
- 📚 [Moodle setup](moodle_setup.md)
- ☁️ [Deployment](deploy/DEPLOY.md)

---

## 👥 Team

| Member | GitHub |
|---|---|
| Ishadhi Paranage | [@Ishadhisl](https://github.com/Ishadhisl) |
| Lasitha Priyasad | [@Priyasad010](https://github.com/Priyasad010) |
| Parami Pramodya | [@ParamiPramodya](https://github.com/ParamiPramodya) |
| Dilini Kavushalya | [@diliniCoder](https://github.com/diliniCoder) |

---

<div align="center">
  <sub>Built with ❤️ for Thusitha Academy by IIT Group 3</sub>
</div>
