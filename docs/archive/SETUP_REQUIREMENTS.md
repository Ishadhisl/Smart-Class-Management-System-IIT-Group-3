# 🔧 Setup Requirements & Technical Stack

**Read this BEFORE you try to set up the system!**

This document lists what you need to have installed on your computer before starting the Smart Class Management System.

---

## ⚠️ IMPORTANT: Manual Setup Only

යාළුවෝ මේ පියවරවල් ටික **පිළිවෙලින්** කළ යුතුය. Docker මෙහිදී භාවිතා නොවේ.


### 1️⃣ Node.js (Required for Backend)
- **Version**: v20 or higher (recommended: v24.11.1)
- **Download**: https://nodejs.org/
- **Verify**: Open terminal and run:
  ```bash
  node --version
  npm --version
  ```

### 2️⃣ Python (Required for AI Engine)
- **Version**: v3.9 or higher (recommended: v3.12.6)
- **Download**: https://www.python.org/
- **Verify**: Open terminal and run:
  ```bash
  python --version
  ```

### 3️⃣ PostgreSQL (Required for Database)
- **Version**: v15 or v16
- **Download**: https://www.postgresql.org/download/
- **Important**: Set password to `Thusitha@2026` during installation or update it later!
- **Verify**: Open terminal and run:
  ```bash
  psql --version
  ```

### 4️⃣ C++ Build Tools (REQUIRED for AI - Windows Only)
- **Program**: Visual Studio Build Tools 2022
- **Download**: https://visualstudio.microsoft.com/downloads/
- **Workload to Select**: "Desktop development with C++"
- **Important**: Restart computer after installation
- **Why**: Compiles the `dlib` library for face recognition

### 5️⃣ Git (Optional but Recommended)
- **Download**: https://git-scm.com/
- **For**: Cloning the project from GitHub

---

## 📦 Backend Stack (Node.js Packages)

These are installed automatically with `npm install`:

```
express              ^4.18.x     - Web framework
pg                   ^8.x.x      - PostgreSQL connection
dotenv               latest      - Environment variables
bcryptjs             latest      - Password hashing
jsonwebtoken         latest      - User authentication
multer               latest      - File uploads
twilio               latest      - SMS service
node-cron            latest      - Scheduled jobs
exceljs              ^4.4.x      - Excel file processing
cors                 latest      - Cross-origin requests
```

---

## 🐍 AI Engine Stack (Python Packages)

**Only needed if NOT using Docker!**

Create a Python virtual environment first:
```bash
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate # Mac/Linux
```

Then install (in this order):
```bash
pip install cmake                           # Build tool
pip install numpy==2.4.6                    # Math library
pip install opencv-python==4.13.0.92        # Image processing
pip install ultralytics==8.4.67             # YOLOv8
pip install face-recognition==1.3.0         # Face detection
pip install face-recognition-models==0.3.0  # Face models
```

⚠️ **This can take 10-20 minutes** because `dlib` needs to compile from source!

---

## 🎨 Frontend Stack (React/Vite)

These are installed automatically with `npm install`:

```
react                ^18.x.x     - UI framework
react-dom            ^18.x.x     - React DOM
vite                 ^5.x.x      - Build tool
react-router-dom     ^7.x.x      - Page routing
chart.js             ^4.x.x      - Charts & graphs
react-chartjs-2      ^5.x.x      - React charts
axios                latest      - HTTP requests
prop-types           latest      - Type checking
```

---

## 🗄️ Database
### Manual Setup (PostgreSQL):
- Install PostgreSQL v15 or v16.
- Create database and user manually
- Database Name: `thusithaedu_db` (Ensure this matches the database you created)
- Password: `Thusitha@2026`
- See: `DATABASE.md` for detailed instructions

**වැදගත්:** Database එකට සම්බන්ධ වූ පසු, වගු (tables) නිර්මාණය කරන SQL script එකක් ධාවනය කළ යුතුය.
---

## System Requirements

### Minimum (For Testing/Demo)
- **CPU**: Quad-core processor
- **RAM**: 8 GB
- **Storage**: 10 GB free space
- **Network**: Internet connection for package downloads

### Recommended (For Development)
- **CPU**: 6-core processor or better
- **RAM**: 16 GB
- **Storage**: 20 GB SSD
- **Network**: 100 Mbps internet

---

## Estimated Installation Time

| Method | Time | Difficulty |
|--------|------|------------|
| Docker | 5-10 min | Very Easy |
| Manual (Backend) | 20-30 min | Medium |
| Manual (Full Setup) | 60-90 min | Hard |
| Manual (With Issues) | 2+ hours | Very Hard |

---

## ✅ Pre-Installation Checklist

Before you start, confirm:

- [ ] Your computer meets minimum requirements (8 GB RAM)
- [ ] You have admin access to install software
- [ ] You have internet connection (downloads are large)
- [ ] You have 10+ GB free disk space
- [ ] You're using Windows 10/11, Mac, or Linux

---
## 🚨 Common Issues & Prevention

### Issue: "Port already in use"
**Prevention**: Close other programs using ports 5000, 5173, or 5432

### Issue: "Python dlib won't compile"
**Prevention**: Install Visual Studio C++ Build Tools BEFORE running pip install

### Issue: "Database connection refused"
**Prevention**: Make sure PostgreSQL is running before starting backend

### Issue: "npm install fails"
**Prevention**: Clear npm cache: `npm cache clean --force`

## 🆘 If You're Stuck

If setup fails, gather:
- Full error message from terminal
- Your operating system (Windows/Mac/Linux)
- Output of: `node --version`, `python --version`, `pg --version`
- Send to admin for help
---

## 📞 Support Resources

- **Database Issues**: See `DATABASE.md`
- **Local Setup Issues**: See `LOCAL_SETUP.md`
- **Project Overview**: See `README.md`
- **Quick Start**: See `QUICK_START.md`

---

## ✨ Recommended Path

1. Read this file.
2. Read `QUICK_START.md`.
3. Follow the steps exactly.
4. Ask for help if `pip install` fails.

---

**Ready?** Let's go! 🚀
