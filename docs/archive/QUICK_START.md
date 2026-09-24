# ⚡ Quick Start Guide (Manual Setup)

## Simple Local Installation

### Setup Checklist:

1. **Node.js v20** සහ **Python 3.12** install කරන්න.
2. **PostgreSQL** install කරලා `thusithaedu_db` නමින් database එකක් හදන්න.
3. **Visual Studio Build Tools** (C++) install කළොත් Face Recognition වැඩ කරයි. නැත්නම් ඒක නැතුවත් ඉතිරි ටික වැඩ!

---

## Step 1: Install Software

1. Install **Node.js v20** from nodejs.org
2. Install **Python 3.12** from python.org (Install with "Add Python to PATH" checked)
3. Install **PostgreSQL** (Set password to `Thusitha@2026`)
4. Install **Visual Studio Build Tools** (Select "Desktop development with C++" for Face Recognition)

---

## Step 2: Setup Database

1. Open **pgAdmin** or **psql**
2. Create a database named `thusithaedu_db`
3. Ensure `DB_PASSWORD` in `thusitha-backend/.env` is set to `Thusitha@2026` and `DB_NAME` is `thusithaedu_db`.

---

## Step 3: Create Environment Files

Open terminal in the project root folder and run:

```bash
cp thusitha-backend/.env.example thusitha-backend/.env
cp thusitha-frontend/.env.example thusitha-frontend/.env
```

Wait 30-60 seconds until you see something like:
```
✅ Database is ready
✅ Backend is running on http://localhost:5000
✅ Frontend is ready
```

---

## Step 4: Run the Backend

```bash
cd thusitha-backend
npm start
```
Wait until you see: `🚀 Server is running on http://localhost:5000`


## Step 5: Run the Frontend (New Terminal)

```bash
cd thusitha-frontend
npm run dev
```

---

## Step 6: Open in Browser

Paste this in your browser address bar:
```
http://localhost:5173
```

**You should see the Smart Class Management System dashboard!** 🎉

---

## To Stop

Press `Ctrl + C` in your terminal

---

## Common Issues

**"Port already in use"**

**"Can't see the website"**

**"Still stuck?"**
- Don't worry! Ask a technical person to help
- Send them a screenshot of the terminal error
- They can fix it quickly

---

## That's All!

You're done! The system is now:
- ✅ Running
- ✅ Ready to use
- ✅ Connected to the database
- ✅ Backed up and shareable

---

**Next Time**

To use the system again:
1. Open terminal in the project folder
2. Start Backend: `cd thusitha-backend` -> `npm start`
3. Start Frontend: `cd thusitha-frontend` -> `npm run dev`
3. Open http://localhost:5173
4. When done, press `Ctrl + C`

---

**Questions?** Ask the admin! 😊
