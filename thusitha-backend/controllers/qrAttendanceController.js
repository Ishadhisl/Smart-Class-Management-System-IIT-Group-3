const db = require('../db');
const crypto = require('crypto');

const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const QR_EXPIRY_MINUTES = parseInt(process.env.QR_EXPIRY_MINUTES || '15', 10);

const getFrontendUrl = (req) => {
  if (req.headers.origin) {
    return req.headers.origin;
  }
  if (req.headers.referer) {
    try {
      return new URL(req.headers.referer).origin;
    } catch (e) {}
  }
  return PUBLIC_APP_URL;
};

// ─── Helper ─────────────────────────────────────────────────────────────────
/**
 * Generate a cryptographically secure random token and its SHA-256 hash.
 */
function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

// ─── 1. Create Attendance Session ────────────────────────────────────────────
/**
 * POST /api/qr-attendance/sessions
 * Admin / Counter Person only
 * Body: { course_id, schedule_id (optional) }
 */
exports.createSession = async (req, res) => {
  const { course_id, schedule_id } = req.body;
  const userId = req.user?.userId;

  if (!course_id) {
    return res.status(400).json({ success: false, code: 'MISSING_COURSE', message: 'course_id අවශ්‍ය වේ.' });
  }

  try {
    // Check for an already ACTIVE session for this course today
    const existing = await db.pool.query(
      `SELECT session_id FROM Attendance_Sessions
       WHERE course_id = $1 AND status = 'ACTIVE' AND session_date = CURRENT_DATE`,
      [course_id]
    );
    if (existing.rows.length > 0) {
      const sessionId = existing.rows[0].session_id;
      const { raw, hash } = generateToken();
      const expiresAt = new Date(Date.now() + QR_EXPIRY_MINUTES * 60 * 1000);

      await db.pool.query(
        `UPDATE Attendance_Sessions SET qr_token = $1, expires_at = $2 WHERE session_id = $3`,
        [hash, expiresAt, sessionId]
      );

      const courseRes = await db.pool.query('SELECT course_name FROM Courses WHERE course_id = $1', [course_id]);
      const courseName = courseRes.rows[0]?.course_name || 'Unknown';

      const frontendUrl = getFrontendUrl(req);
      const qrUrl = `${frontendUrl}/attendance/verify/${sessionId}?token=${raw}`;

      return res.status(200).json({
        success: true,
        session: {
          session_id: sessionId,
          course_id: course_id,
          course_name: courseName,
          session_date: new Date(),
          expires_at: expiresAt,
          status: 'ACTIVE',
          qr_url: qrUrl,
          raw_token: raw
        }
      });
    }

    const { raw, hash } = generateToken();
    const expiresAt = new Date(Date.now() + QR_EXPIRY_MINUTES * 60 * 1000);

    const result = await db.pool.query(
      `INSERT INTO Attendance_Sessions
         (course_id, schedule_id, session_date, qr_token, expires_at, status, created_by)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, 'ACTIVE', $5)
       RETURNING session_id, course_id, session_date, expires_at, status, created_at`,
      [course_id, schedule_id || null, hash, expiresAt, userId]
    );

    const session = result.rows[0];

    // Fetch course name for the response
    const courseRes = await db.pool.query('SELECT course_name FROM Courses WHERE course_id = $1', [course_id]);
    const courseName = courseRes.rows[0]?.course_name || 'Unknown';

    const frontendUrl = getFrontendUrl(req);
    const qrUrl = `${frontendUrl}/attendance/verify/${session.session_id}?token=${raw}`;

    return res.status(201).json({
      success: true,
      session: {
        session_id: session.session_id,
        course_id: session.course_id,
        course_name: courseName,
        session_date: session.session_date,
        expires_at: session.expires_at,
        status: session.status,
        created_at: session.created_at,
        qr_url: qrUrl,
        raw_token: raw  // sent once, used to build QR URL on frontend
      }
    });
  } catch (err) {
    console.error('❌ createSession error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
};

// ─── 2. Get Session Details ───────────────────────────────────────────────────
/**
 * GET /api/qr-attendance/sessions/:id
 * Admin / Counter Person
 */
exports.getSession = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query(
      `SELECT s.session_id, s.course_id, s.session_date, s.expires_at, s.status, s.created_at,
              c.course_name
       FROM Attendance_Sessions s
       JOIN Courses c ON s.course_id = c.course_id
       WHERE s.session_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND', message: 'සැසිය හමු නොවිණි.' });
    }

    const session = result.rows[0];

    // Auto-expire: if expires_at is past and status is still ACTIVE
    if (session.status === 'ACTIVE' && new Date(session.expires_at) < new Date()) {
      await db.pool.query(
        "UPDATE Attendance_Sessions SET status = 'EXPIRED', updated_at = NOW() WHERE session_id = $1",
        [id]
      );
      session.status = 'EXPIRED';
    }

    return res.status(200).json({ success: true, session });
  } catch (err) {
    console.error('❌ getSession error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
};

// ─── 3. Get Full Attendance List for a Session ───────────────────────────────
/**
 * GET /api/qr-attendance/sessions/:id/attendance
 * Admin / Counter Person — full enrolled student list with current status
 */
exports.getSessionAttendanceList = async (req, res) => {
  const { id } = req.params;
  try {
    // Verify session exists
    const sessionRes = await db.pool.query(
      'SELECT session_id, course_id FROM Attendance_Sessions WHERE session_id = $1',
      [id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND', message: 'සැසිය හමු නොවිණි.' });
    }
    const { course_id } = sessionRes.rows[0];

    // Get all enrolled students LEFT JOIN attendance logs for this session
    const result = await db.pool.query(
      `SELECT
         s.student_id,
         s.student_name,
         s.qr_code_key AS student_ref_id,
         CASE WHEN sal.log_id IS NOT NULL THEN 'PRESENT' ELSE 'NOT_PRESENT' END AS attendance_status,
         sal.method,
         sal.scanned_at AS marked_time
       FROM Course_Enrollments ce
       JOIN Students s ON ce.student_id = s.student_id
       LEFT JOIN Student_Attendance_Logs sal
         ON sal.student_id = s.student_id AND sal.session_id = $1
       WHERE ce.course_id = $2
       ORDER BY s.student_name ASC`,
      [id, course_id]
    );

    const totalEnrolled = result.rows.length;
    const presentCount = result.rows.filter(r => r.attendance_status === 'PRESENT').length;

    return res.status(200).json({
      success: true,
      students: result.rows,
      summary: {
        total_enrolled: totalEnrolled,
        present: presentCount,
        not_present: totalEnrolled - presentCount
      }
    });
  } catch (err) {
    console.error('❌ getSessionAttendanceList error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
};

// ─── 4. Stop Session ─────────────────────────────────────────────────────────
/**
 * PATCH /api/qr-attendance/sessions/:id/stop
 * Admin / Counter Person
 */
exports.stopSession = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query(
      `UPDATE Attendance_Sessions
       SET status = 'STOPPED', updated_at = NOW()
       WHERE session_id = $1 AND status = 'ACTIVE'
       RETURNING session_id, status`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND_OR_INACTIVE', message: 'සක්‍රිය සැසිය හමු නොවිණි.' });
    }
    return res.status(200).json({ success: true, message: 'සැසිය සාර්ථකව නතර කළා.', session: result.rows[0] });
  } catch (err) {
    console.error('❌ stopSession error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
};

// ─── 5. Get Active Session for a Course ──────────────────────────────────────
/**
 * GET /api/qr-attendance/sessions/active/:courseId
 * Admin / Counter Person
 */
exports.getActiveSessionByCourse = async (req, res) => {
  const { courseId } = req.params;
  try {
    const result = await db.pool.query(
      `SELECT s.session_id, s.course_id, s.session_date, s.expires_at, s.status, s.created_at,
              c.course_name
       FROM Attendance_Sessions s
       JOIN Courses c ON s.course_id = c.course_id
       WHERE s.course_id = $1 AND s.session_date = CURRENT_DATE
       ORDER BY s.created_at DESC LIMIT 1`,
      [courseId]
    );
    if (result.rows.length === 0) {
      return res.status(200).json({ success: true, session: null });
    }
    const session = result.rows[0];
    // Auto-expire check
    if (session.status === 'ACTIVE' && new Date(session.expires_at) < new Date()) {
      await db.pool.query(
        "UPDATE Attendance_Sessions SET status = 'EXPIRED', updated_at = NOW() WHERE session_id = $1",
        [session.session_id]
      );
      session.status = 'EXPIRED';
    }
    return res.status(200).json({ success: true, session });
  } catch (err) {
    console.error('❌ getActiveSessionByCourse error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
};

// ─── 6. Mark Attendance via QR (Student auto-call) ───────────────────────────
/**
 * POST /api/qr-attendance/mark
 * Student only — identity comes from JWT, NOT from request body
 * Body: { session_id, qr_token }
 */
exports.markAttendance = async (req, res) => {
  const { session_id, qr_token } = req.body;
  const userId = req.user?.userId; // from JWT middleware

  if (!session_id || !qr_token) {
    return res.status(400).json({ success: false, code: 'QR_INVALID', message: 'session_id සහ qr_token අවශ්‍ය වේ.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // STEP 1: Find session
    const sessionRes = await client.query(
      `SELECT s.session_id, s.course_id, s.expires_at, s.status, s.qr_token,
              c.course_name
       FROM Attendance_Sessions s
       JOIN Courses c ON s.course_id = c.course_id
       WHERE s.session_id = $1`,
      [session_id]
    );
    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND', message: 'QR Attendance සැසිය හමු නොවිණි.' });
    }
    const session = sessionRes.rows[0];

    // STEP 2: Check session status
    if (session.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      const code = session.status === 'EXPIRED' ? 'QR_EXPIRED' : 'SESSION_INACTIVE';
      const msg = session.status === 'EXPIRED'
        ? 'QR Attendance කාලය ඉකුත් වී ඇත.'
        : 'QR Attendance සැසිය ක්‍රියාත්මක නොවේ.';
      return res.status(400).json({ success: false, code, message: msg, status: session.status });
    }

    // STEP 3: Auto-expire check (even if DB says ACTIVE)
    if (new Date(session.expires_at) < new Date()) {
      await client.query(
        "UPDATE Attendance_Sessions SET status = 'EXPIRED', updated_at = NOW() WHERE session_id = $1",
        [session_id]
      );
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, code: 'QR_EXPIRED', message: 'QR Attendance කාලය ඉකුත් වී ඇත.' });
    }

    // STEP 4: Validate QR token (compare against stored hash)
    const tokenHash = crypto.createHash('sha256').update(qr_token).digest('hex');
    if (tokenHash !== session.qr_token) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, code: 'QR_INVALID', message: 'QR Code වලංගු නොවේ.' });
    }

    // STEP 5: Find student from JWT user ID (Students.user_id → Users.user_id)
    const studentRes = await client.query(
      `SELECT student_id, student_name
       FROM Students
       WHERE user_id = $1`,
      [userId]
    );
    const student = studentRes.rows[0];

    if (!student) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'ශිෂ්‍ය ගිණුමක් හමු නොවිණි.' });
    }

    // STEP 6: Check enrollment
    const enrollRes = await client.query(
      'SELECT 1 FROM Course_Enrollments WHERE student_id = $1 AND course_id = $2',
      [student.student_id, session.course_id]
    );
    if (enrollRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, code: 'NOT_ENROLLED', message: 'ඔබ මෙම පන්තියේ ලියාපදිංචි නොවේ.' });
    }

    // STEP 7: Check duplicate attendance
    const dupRes = await client.query(
      'SELECT log_id, scanned_at, method FROM Student_Attendance_Logs WHERE student_id = $1 AND session_id = $2',
      [student.student_id, session_id]
    );
    if (dupRes.rows.length > 0) {
      await client.query('ROLLBACK');
      const existing = dupRes.rows[0];
      return res.status(200).json({
        success: true,
        code: 'ALREADY_MARKED',
        message: 'ඔබගේ පැමිණීම දැනටමත් සටහන් කර ඇත.',
        attendance: {
          student_name: student.student_name,
          course_name: session.course_name,
          status: 'PRESENT',
          method: existing.method,
          marked_time: existing.scanned_at
        }
      });
    }

    // STEP 8: Create attendance record
    const insertRes = await client.query(
      `INSERT INTO Student_Attendance_Logs
         (student_id, course_id, session_id, attendance_status, method, scanned_at)
       VALUES ($1, $2, $3, 'Present', 'QR', NOW())
       RETURNING scanned_at`,
      [student.student_id, session.course_id, session_id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      code: 'ATTENDANCE_MARKED',
      message: 'පැමිණීම සාර්ථකව සටහන් කළා!',
      attendance: {
        student_name: student.student_name,
        course_name: session.course_name,
        status: 'PRESENT',
        method: 'QR',
        marked_time: insertRes.rows[0].scanned_at
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // Handle unique constraint violation (race condition duplicate)
    if (err.code === '23505') {
      return res.status(200).json({
        success: true,
        code: 'ALREADY_MARKED',
        message: 'ඔබගේ පැමිණීම දැනටමත් සටහන් කර ඇත.'
      });
    }
    console.error('❌ markAttendance error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
};

// ─── 7. Verify QR Route (public check used by frontend before auto-mark) ─────
/**
 * GET /api/qr-attendance/verify/:sessionId?token=...
 * Public — checks if the QR is still valid (without marking)
 * Used by the frontend to decide if it should attempt to mark
 */
exports.verifyQR = async (req, res) => {
  const { sessionId } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, code: 'QR_INVALID', message: 'Token හමු නොවිණි.' });
  }

  try {
    const sessionRes = await db.pool.query(
      `SELECT s.session_id, s.course_id, s.expires_at, s.status, s.qr_token, c.course_name
       FROM Attendance_Sessions s
       JOIN Courses c ON s.course_id = c.course_id
       WHERE s.session_id = $1`,
      [sessionId]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND', message: 'සැසිය හමු නොවිණි.' });
    }
    const session = sessionRes.rows[0];

    if (session.status !== 'ACTIVE' || new Date(session.expires_at) < new Date()) {
      const code = session.status === 'STOPPED' ? 'SESSION_INACTIVE' : 'QR_EXPIRED';
      return res.status(400).json({ success: false, code, message: 'QR valid නොවේ.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== session.qr_token) {
      return res.status(400).json({ success: false, code: 'QR_INVALID', message: 'QR Code වලංගු නොවේ.' });
    }

    return res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        course_name: session.course_name,
        expires_at: session.expires_at,
        status: session.status
      }
    });
  } catch (err) {
    console.error('❌ verifyQR error:', err.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
};
