const db = require('../db');
const auditService = require('../utils/auditService');
const { sanitizeText } = require('../utils/validators');

// Resolve the Teachers.teacher_id for the logged-in teacher user.
async function teacherIdFor(userId) {
  const r = await db.pool.query('SELECT teacher_id FROM Teachers WHERE user_id = $1', [userId]);
  return r.rows[0]?.teacher_id || null;
}

// Teacher: ask an Admin for permission to view a course's CCTV footage.
exports.requestAccess = async (req, res) => {
  const { course_id } = req.body;
  let { note } = req.body;
  if (!course_id) return res.status(400).json({ error: 'පන්තිය (course_id) අවශ්‍ය වේ.' });
  note = note ? sanitizeText(note, 500) : null;
  try {
    const teacherId = await teacherIdFor(req.user.userId);
    if (!teacherId) return res.status(400).json({ error: 'ගුරු ගිණුමක් හමු නොවීය.' });

    // Don't stack duplicate open requests for the same course.
    const dup = await db.pool.query(
      `SELECT request_id, status FROM CCTV_Access_Requests
       WHERE teacher_id = $1 AND course_id = $2 AND status IN ('Pending', 'Approved')
       ORDER BY request_id DESC LIMIT 1`,
      [teacherId, course_id]
    );
    if (dup.rows.length > 0) {
      return res.status(200).json({
        message: dup.rows[0].status === 'Approved'
          ? 'ඔබට මෙම පන්තියේ CCTV දර්ශන බැලීමට දැනටමත් අවසර ඇත.'
          : 'ඔබගේ ඉල්ලීම දැනටමත් පරිපාලක අනුමැතිය සඳහා පොරොත්තුවෙන් ඇත.',
        status: dup.rows[0].status
      });
    }

    const ins = await db.pool.query(
      `INSERT INTO CCTV_Access_Requests (teacher_id, course_id, note, status)
       VALUES ($1, $2, $3, 'Pending') RETURNING *`,
      [teacherId, course_id, note || null]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'CCTV_Access_Requests', ins.rows[0].request_id, `Requested CCTV access for course ${course_id}`);
    res.status(201).json({ message: 'ඉල්ලීම පරිපාලකයාට යවන ලදී. අනුමැතිය ලැබුණු පසු දර්ශන බැලිය හැක.', request: ins.rows[0] });
  } catch (err) {
    console.error('❌ CCTV requestAccess error:', err.message);
    res.status(500).json({ error: 'ඉල්ලීම යැවීම අසාර්ථකයි.' });
  }
};

// Teacher: my requests + the set of course ids I'm currently approved for.
exports.myAccess = async (req, res) => {
  try {
    const teacherId = await teacherIdFor(req.user.userId);
    if (!teacherId) return res.json({ requests: [], approvedCourseIds: [] });
    const r = await db.pool.query(
      `SELECT car.*, c.course_name
       FROM CCTV_Access_Requests car
       LEFT JOIN Courses c ON car.course_id = c.course_id
       WHERE car.teacher_id = $1
       ORDER BY car.request_id DESC`,
      [teacherId]
    );
    const approvedCourseIds = r.rows.filter(x => x.status === 'Approved').map(x => x.course_id);
    res.json({ requests: r.rows, approvedCourseIds });
  } catch (err) {
    console.error('❌ CCTV myAccess error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Admin: list pending requests (for the home-dashboard popup).
exports.pending = async (req, res) => {
  try {
    const r = await db.pool.query(
      `SELECT car.request_id, car.course_id, car.note, car.requested_at,
              t.teacher_name, c.course_name
       FROM CCTV_Access_Requests car
       LEFT JOIN Teachers t ON car.teacher_id = t.teacher_id
       LEFT JOIN Courses c ON car.course_id = c.course_id
       WHERE car.status = 'Pending'
       ORDER BY car.requested_at ASC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('❌ CCTV pending error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Admin: approve / deny a request.
exports.decide = async (req, res) => {
  const { id } = req.params;
  const { decision } = req.body;
  if (!['Approved', 'Denied'].includes(decision)) {
    return res.status(400).json({ error: "decision එක 'Approved' හෝ 'Denied' විය යුතුයි." });
  }
  try {
    const r = await db.pool.query(
      `UPDATE CCTV_Access_Requests
       SET status = $1, decided_by = $2, decided_at = CURRENT_TIMESTAMP
       WHERE request_id = $3 AND status = 'Pending'
       RETURNING *`,
      [decision, req.user.userId, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'ඉල්ලීම හමු නොවීය හෝ දැනටමත් තීරණය කර ඇත.' });
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'CCTV_Access_Requests', id, `CCTV access ${decision} for request ${id}`);
    res.json({ message: decision === 'Approved' ? 'අනුමත කරන ලදී.' : 'ප්‍රතික්ෂේප කරන ලදී.', request: r.rows[0] });
  } catch (err) {
    console.error('❌ CCTV decide error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Guard used by the CCTV upload endpoint: a Teacher needs an Approved row for the course.
exports.teacherHasApproval = async (userId, courseId) => {
  const teacherId = await teacherIdFor(userId);
  if (!teacherId || !courseId) return false;
  const r = await db.pool.query(
    `SELECT 1 FROM CCTV_Access_Requests
     WHERE teacher_id = $1 AND course_id = $2 AND status = 'Approved' LIMIT 1`,
    [teacherId, courseId]
  );
  return r.rows.length > 0;
};
