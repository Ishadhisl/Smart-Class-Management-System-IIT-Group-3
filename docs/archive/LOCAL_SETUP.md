# 💻 Local Development Setup (Manual)

**For developers who want full control over their environment**

This guide walks you through setting up everything locally on your Windows/Mac/Linux machine.

**Time Required**: 60-90 minutes (depending on your internet speed)

---

## Step 1: Install Node.js

### For Windows:
1. Download: https://nodejs.org/ (choose LTS v20 or v24)
2. Run installer, accept defaults
3. Restart your computer

### For Mac:
```bash
brew install node
```

### For Linux (Ubuntu):
```bash
sudo apt-get update
sudo apt-get install nodejs npm
```

### Verify Installation:
```bash
node --version    # Should show v20+ or v24+
npm --version     # Should show 10+
```

---

## Step 2: Install Python

### For Windows:
1. Download: https://www.python.org/
2. **IMPORTANT**: Check "Add Python to PATH" during installation
3. Run installer with defaults
4. Restart computer

### For Mac:
```bash
brew install python@3.12
```

### For Linux (Ubuntu):
```bash
sudo apt-get install python3.12 python3-pip
```

### Verify Installation:
```bash
python --version    # Should show Python 3.9+
python -m pip --version
```

---

## Step 3: Install PostgreSQL

### For Windows:
1. Download: https://www.postgresql.org/download/windows/
2. Run installer
3. **Remember the password you set!**
4. Default port: 5432
5. Restart computer

### For Mac:
```bash
brew install postgresql@15
brew services start postgresql@15
```

### For Linux (Ubuntu):
```bash
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

### Verify Installation:
```bash
psql --version    # Should show PostgreSQL 15+
```

---

## Step 4: Install C++ Build Tools (Windows ONLY)

**This is MANDATORY for the AI engine to work!**

### Windows:
1. Download: https://visualstudio.microsoft.com/downloads/
2. Look for "Tools for Visual Studio 2022"
3. Click "Download" for "Visual Studio Build Tools 2022"
4. Run installer
5. **Select workload**: "Desktop development with C++"
6. Wait for installation (5-10 GB)
7. **Restart your computer** (this is important!)

### Mac/Linux:
C++ tools are usually already installed. Skip this step.

---

## Step 5: Create Database & User

### Open PostgreSQL:

**Windows:**
```bash
psql -U postgres
```

**Mac/Linux:**
```bash
sudo -u postgres psql
```

### Run these commands:

```sql
-- Create database
CREATE DATABASE thusithaedu_db;

-- Create user
CREATE USER smartclass WITH PASSWORD 'Thusitha@2026';

-- Grant permissions
ALTER ROLE smartclass SET client_encoding TO 'utf8';
ALTER ROLE smartclass SET default_transaction_isolation TO 'read committed';
ALTER ROLE smartclass SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE thusithaedu_db TO smartclass;

-- Exit
\q
```

---

## Step 6: Clone Project

```bash
git clone https://github.com/your-username/Smart-Class-Management-System.git
cd Smart-Class-Management-System
```

Or download ZIP and extract.

---

## Step 7: Backend Setup

### Navigate to backend:
```bash
cd thusitha-backend
```

### Create environment file:
```bash
cp .env.example .env
```

### Edit `.env`:
```
DB_USER=smartclass
DB_PASSWORD=password123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=thusithaedu_db
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
```

### Install Node dependencies:
```bash
npm install
```

### Create Python virtual environment:

**Windows:**
```bash
python -m venv venv
.\venv\Scripts\activate
```

**Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Install build tools in venv:
```bash
pip install cmake
```

### Install Python dependencies:
```bash
pip install opencv-python==4.13.0.92
pip install ultralytics==8.4.67
pip install numpy==2.4.6
pip install face-recognition==1.3.0
pip install face-recognition-models==0.3.0
```

⚠️ **This takes 10-20 minutes** (dlib compilation)

### Start backend:
```bash
npm start
```

You should see:
```
✅ Database Connection Pool established
🚀 Server is running on http://localhost:5000
```

---

## Step 8: Frontend Setup (New Terminal)

### Navigate to frontend:
```bash
cd thusitha-frontend
```

### Create environment file:
```bash
cp .env.example .env.local
```

### Edit `.env.local`:
```
VITE_API_URL=http://localhost:5000
```

### Install dependencies:
```bash
npm install
```

### Start development server:
```bash
npm run dev
```

You should see:
```
VITE v... ready in ... ms

➜  Local:   http://localhost:5173/
```

---

## Step 9: Test Everything

### In your browser:
1. Open http://localhost:5173
2. You should see the Smart Class Management dashboard
3. All features should work!

### Backend health check:
```bash
curl http://localhost:5000/health
```

### Database test:
```bash
psql -U smartclass -d smartclass_db
\dt  # List all tables
\q   # Exit
```

---

## Development Workflow

### Terminal 1 (Backend):
```bash
cd thusitha-backend
.\venv\Scripts\activate  # Windows
npm start
```

### Terminal 2 (Frontend):
```bash
cd thusitha-frontend
npm run dev
```

### Terminal 3 (Database):
```bash
# Keep PostgreSQL running (already started)
# Or restart if needed:
pg_ctl restart
```

### Make changes:
- Edit code in `thusitha-backend/` or `thusitha-frontend/`
- Both have hot-reload enabled
- Changes appear immediately in browser

---

## Python Virtual Environment

### Activate (Windows):
```bash
.\venv\Scripts\activate
```

### Activate (Mac/Linux):
```bash
source venv/bin/activate
```

### Deactivate:
```bash
deactivate
```

### Install new Python package:
```bash
# Make sure venv is activated first!
pip install package-name
```

---

## Useful Development Commands

### Backend:

```bash
# Install new Node package
npm install package-name

# Run tests (if you add them)
npm test

# View backend logs
npm start

# Hot reload enabled - just save files
```

### Frontend:

```bash
# Install new package
npm install package-name

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Database:

```bash
# Connect to database
psql -U smartclass -d smartclass_db

# Backup database
pg_dump -U smartclass -d smartclass_db > backup.sql

# Restore database
psql -U smartclass -d smartclass_db < backup.sql
```

---

## Troubleshooting

### Issue: "Cannot find module"
```bash
# Clear cache
npm cache clean --force
rm -rf node_modules
npm install
```

### Issue: "Database connection refused"
```bash
# Check PostgreSQL is running
pg_isready

# Restart PostgreSQL
pg_ctl restart
```

### Issue: "Port already in use"
```bash
# Kill process using port 5000 (Windows)
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Kill process using port 5000 (Mac/Linux)
lsof -i :5000
kill -9 <PID>
```

### Issue: "dlib won't compile"
```
Error: CMake must be installed

Solution:
1. Make sure Visual Studio Build Tools are installed
2. Restart your computer
3. Try pip install again
```

### Issue: "Python module not found"
```bash
# Make sure venv is activated!
.\venv\Scripts\activate  # Windows
source venv/bin/activate # Mac/Linux

# Check which Python is running
which python  # or where python (Windows)

# Should show path in venv folder
```

---

## Git Workflow

### Commit changes:
```bash
git add .
git commit -m "Description of changes"
git push origin main
```

### Pull latest changes:
```bash
git pull origin main

# If you changed package.json:
npm install
```

### Create new branch:
```bash
git checkout -b feature-name
# Make changes
git commit -m "Add feature"
git push origin feature-name
# Create Pull Request on GitHub
```

---

## Production Build

### Build frontend:
```bash
cd thusitha-frontend
npm run build
# Creates: dist/ folder
```

### Build backend:
```bash
cd thusitha-backend
# No build needed for Node.js backend
# Just deploy the files as-is
```

---

## VS Code Recommended Extensions

- ESLint
- Prettier
- Thunder Client (API testing)
- PostgreSQL Explorer
- Python
- Pylance
- Vite

---

## Environment Variables Checklist

**Backend (.env)**
- [ ] DB_USER=smartclass
- [ ] DB_PASSWORD=password123
- [ ] DB_HOST=localhost
- [ ] DB_PORT=5432
- [ ] DB_NAME=smartclass_db
- [ ] PORT=5000
- [ ] NODE_ENV=development
- [ ] JWT_SECRET=your-secret-key

**Frontend (.env.local)**
- [ ] VITE_API_URL=http://localhost:5000

---

## Next Steps

1. ✅ Follow steps 1-9 above
2. ✅ Make a test commit to Git
3. ✅ Create a feature branch
4. ✅ Make a small code change
5. ✅ Push to GitHub
6. ✅ Create a Pull Request

---

## Need Help?

- Check logs in terminal
- Search error message online
- Ask team members
- Review `README.md` for overview
- Check `DATABASE.md` for database issues

---

**Happy developing! 🚀**
