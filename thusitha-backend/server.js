require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const os = require('os'); // Network IP detection
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { initSchema } = require('./utils/initSchema');
const { seedDemoUsers } = require('./utils/seedUsers');

// Same locally-trusted dev certificate the frontend (Vite) uses - see vite.config.js for why:
// navigator.mediaDevices (webcam access) needs a secure context, and an https frontend page
// calling this API over plain http would also get blocked by the browser as mixed content.
// In production this runs behind a reverse proxy (Nginx) that terminates real HTTPS with a
// trusted cert instead, so the certs/ dev pair won't exist there - fall back to plain HTTP.
const devKeyPath = path.resolve(__dirname, '..', 'certs', 'dev-key.pem');
const devCertPath = path.resolve(__dirname, '..', 'certs', 'dev-cert.pem');
const httpsOptions = (fs.existsSync(devKeyPath) && fs.existsSync(devCertPath))
  ? { key: fs.readFileSync(devKeyPath), cert: fs.readFileSync(devCertPath) }
  : null;

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes'); 
const reportRoutes = require('./routes/reportRoutes');
const parentRoutes = require('./routes/parentRoutes');
const studyAreaRoutes = require('./routes/studyAreaRoutes');
const examRoutes = require('./routes/examRoutes');
const smsRoutes = require('./routes/smsRoutes');
const hallRoutes = require('./routes/hallRoutes');
const classScheduleRoutes = require('./routes/classScheduleRoutes');
const cameraZoneRoutes = require('./routes/cameraZoneRoutes');
const promoRoutes = require('./routes/promoRoutes');
const contactRoutes = require('./routes/contactRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const auditRoutes = require('./routes/auditRoutes');
const smsService = require('./utils/smsService'); // Import smsService
const { initWhatsApp } = require('./utils/whatsappService'); // WhatsApp Service
const { initCronJobs } = require('./utils/cronJobs');
const materialRoutes = require('./routes/materialRoutes');
const moodleSsoRoutes = require('./routes/moodleSsoRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const qrAttendanceRoutes = require('./routes/qrAttendanceRoutes');
const cctvAccessRoutes = require('./routes/cctvAccessRoutes');
const agendaRoutes = require('./routes/agendaRoutes');

const app = express();
app.disable('x-powered-by');

const isPrivateIP = (originUrl) => {
  try {
    const parsed = new URL(originUrl);
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
    const classBParts = hostname.match(/^172\.(\d+)\.\d+\.\d+$/);
    if (classBParts) {
      const secondOctet = parseInt(classBParts[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    }
    return false;
  } catch (e) {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // FRONTEND_URL=* is a literal wildcard (used before the real deploy URL is known) -
    // without this, "*" would just be compared as a normal string below and match nothing.
    if (process.env.FRONTEND_URL === '*') return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'https://localhost:5173',
      'https://localhost:5174',
      'https://127.0.0.1:5173',
    ].filter(Boolean);

    if (allowed.includes(origin) || isPrivateIP(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  optionsSuccessStatus: 204
};
// Sets X-Content-Type-Options, X-Frame-Options, a conservative X-XSS-Protection-style
// posture, etc. CSP is left off: this is a pure JSON API (the frontend is a separate
// Vercel-hosted SPA), so there's no first-party HTML/inline-script surface for a CSP
// to protect here - only /uploads serves static files, and those are never rendered
// as HTML by this server.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
app.use(express.json());

// static middleware to serve uploaded files (PDFs, Images)
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('Welcome to the Thusitha Institute Smart Class Management System API');
});

// ── System: Return the machine's current local network IP ─────────────────────
// This is used by the frontend QR tab to build a scannable URL for phones,
// while the admin can keep using localhost (required for webcam access).
app.get('/api/system/ip', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    let networkIp = null;
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and non-IPv4
        if (iface.family === 'IPv4' && !iface.internal) {
          networkIp = iface.address;
          break;
        }
      }
      if (networkIp) break;
    }
    const port = process.env.PORT || 5000;
    const frontendPort = 5173;
    res.json({
      ip: networkIp || '127.0.0.1',
      backendUrl: `https://${networkIp || 'localhost'}:${port}`,
      frontendUrl: `https://${networkIp || 'localhost'}:${frontendPort}`
    });
  } catch (e) {
    res.json({ ip: '127.0.0.1', backendUrl: 'https://localhost:5000', frontendUrl: 'https://localhost:5173' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/attendance', attendanceRoutes); 
app.use('/api/reports', reportRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/study-area', studyAreaRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/halls', hallRoutes);
app.use('/api/classes', classScheduleRoutes);
app.use('/api/camera-zones', cameraZoneRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/moodle-sso', moodleSsoRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/qr-attendance', qrAttendanceRoutes);
app.use('/api/cctv-access', cctvAccessRoutes);
app.use('/api/agenda', agendaRoutes);

const PORT = process.env.PORT || 5000;

app.use((err, req, res, next) => {
  console.error('❌ Global Error Handler:', err.stack);
  
  if (err.message && (err.message.includes('Invalid file type') || err.message.includes('අනුමත නොකරන ලද') || err.code === 'LIMIT_FILE_SIZE')) {
    return res.status(400).json({
      status: 'Error',
      message: err.message
    });
  }

  res.status(500).json({
    status: 'Error',
    message: 'An internal server error occurred',
    details: process.env.NODE_ENV === 'development' ? err.message : null
  });
});

const net = require('net');
const { spawn } = require('child_process');

function startAIServer() {
  const pythonPath = 'python';
  const scriptPath = path.resolve(__dirname, '..', 'fastapi_service', 'main.py');
  
  console.log(`🤖 Starting AI Server (Python uvicorn) from: ${scriptPath}`);
  
  // Capture the child's output (was 'ignore') so Render logs show *why* the AI service
  // dies — an OOM kill, a missing dep or an import error all looked identical before.
  const pyProcess = spawn(pythonPath, [scriptPath], {
    cwd: path.resolve(__dirname, '..', 'fastapi_service'),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Tell main.py to skip uvicorn's reload/file-watcher (extra RAM) when we're not in dev.
    env: { ...process.env, ENV: process.env.NODE_ENV === 'production' ? 'production' : 'development' }
  });

  pyProcess.stdout.on('data', (d) => process.stdout.write(`[AI] ${d}`));
  pyProcess.stderr.on('data', (d) => process.stderr.write(`[AI] ${d}`));

  pyProcess.on('error', (err) => {
    console.error('❌ Failed to start AI Python server:', err.message);
  });

  pyProcess.on('exit', (code, signal) => {
    console.error(`❌ AI Python server exited (code=${code}, signal=${signal}). ` +
      `Face-encoding / headcount will be unavailable until it restarts. ` +
      `If code=null/signal=SIGKILL this is almost certainly an out-of-memory kill — ` +
      `the AI stack needs a >=2GB instance.`);
  });

  pyProcess.unref();
}

function checkAndStartAIServer() {
  // dlib/YOLO genuinely need a >=2GB instance (see the OOM note in startAIServer's exit
  // handler above). On Render's 512MB Free tier this doesn't just fail to start - it OOM-
  // kills the WHOLE container (Node, WhatsApp, everything), not just the AI process, every
  // time the service boots. Set AI_SERVER_ENABLED=false while on a low-memory instance to
  // keep the rest of the app stable; remove it (or set back to true) once upgraded again.
  if (process.env.AI_SERVER_ENABLED === 'false') {
    console.log('ℹ️  AI Server disabled (AI_SERVER_ENABLED=false) — skipping. Face-encoding/headcount will be unavailable.');
    return;
  }

  const client = new net.Socket();

  client.once('connect', () => {
    console.log('✅ AI Server is already running on port 8000.');
    client.destroy();
  });
  
  client.once('error', (err) => {
    console.log('🔄 AI Server not detected on port 8000. Launching...');
    startAIServer();
  });
  
  client.connect(8000, '127.0.0.1');
}

const server = httpsOptions ? https.createServer(httpsOptions, app) : http.createServer(app);

async function bootstrap() {
  // Keep the hosted DB in lock-step with the code before we accept traffic. Skipped
  // under test (the Jest suites mock the DB and manage their own fixtures).
  if (process.env.NODE_ENV !== 'test') {
    try {
      await initSchema();
    } catch (err) {
      console.error('⚠️  Schema sync threw (starting server anyway):', err.message);
    }
    try {
      await seedDemoUsers();
    } catch (err) {
      console.error('⚠️  Demo user seed threw (starting server anyway):', err.message);
    }
  }

  server.listen(PORT, () => {
    const scheme = httpsOptions ? 'https' : 'http';
    console.log(`🚀 Server is running on ${scheme}://localhost:${PORT}`);
    checkAndStartAIServer();
  });

  // Start automated tasks
  initCronJobs(); // 💡 Automated tasks enabled

  // 📱 Initialize WhatsApp Client
  console.log('📱 Starting WhatsApp Service (Baileys)...');
  console.log('👉 Link the institute phone from Admin dashboard → සන්නිවේදන මධ්‍යස්ථානය → WhatsApp Connect.');
  initWhatsApp();
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

module.exports = server;
