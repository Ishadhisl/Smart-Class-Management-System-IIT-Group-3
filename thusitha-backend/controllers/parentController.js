const db = require('../db');
const bcrypt = require('bcryptjs');

const auditService = require('../utils/auditService');
const { defaultPasswordFor } = require('../utils/authDefaults');
const { isValidPhone, sanitizeText } = require('../utils/validators');

exports.registerParent = async (req, res) => {
  let { username, password, parent_name, parent_phone, address } = req.body;

  if (!username || !parent_name) {
    return res.status(400).json({ error: 'පරිශීලක නාමය සහ මව්පියන්ගේ නම අනිවාර්ය වේ.' });
  }
  if (parent_phone && !isValidPhone(parent_phone)) {
    return res.status(400).json({ error: 'වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න (උදා: 0712345678).' });
  }

  username = sanitizeText(username, 100);
  parent_name = sanitizeText(parent_name, 150);
  address = address ? sanitizeText(address, 300) : null;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the User record (Role: Parent) — blank password => Parent@123
    const passwordHash = await bcrypt.hash(password || defaultPasswordFor('Parent'), 10);

    const userResult = await client.query(
      'INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
      [username, passwordHash, 'Parent']
    );
    const userId = userResult.rows[0].user_id;

    // 2. Create the Parent profile linked to user_id
    const parentResult = await client.query(
      'INSERT INTO Parents (user_id, parent_name, parent_phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, parent_name, parent_phone, address]
    );

    await client.query('COMMIT');
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Parent', parentResult.rows[0].parent_id, `Registered new parent: ${parent_name} (User ID: ${userId})`);
    res.status(201).json({ message: 'Parent registered successfully', parent: parentResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Parent Registration Error:', err.message);
    res.status(500).json({ error: 'Failed to register parent', details: err.message });
  } finally {
    client.release();
  }
};

exports.getAllParents = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM Parents ORDER BY parent_id DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get All Parents Error:', error.message);
    res.status(500).json({ message: "මව්පියන්ගේ දත්ත ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.getMyChildrenDetails = async (req, res) => {
  try {
    const parentUserRes = await db.pool.query('SELECT parent_id FROM Parents WHERE user_id = $1', [req.user.userId]);
    if (parentUserRes.rows.length === 0) {
      return res.status(404).json({ message: "මව්පිය ගිණුම සොයාගත නොහැකි විය." });
    }
    const parentId = parentUserRes.rows[0].parent_id;

    // Get children
    const childrenRes = await db.pool.query(
      'SELECT student_id, student_name, school, grade, qr_code_key, profile_photo_path FROM Students WHERE parent_id = $1',
      [parentId]
    );

    const childrenData = [];

    for (const child of childrenRes.rows) {
      // Get enrolled courses
      const courses = await db.pool.query(
        `SELECT c.course_id, c.course_name, c.monthly_fee
         FROM Course_Enrollments ce
         JOIN Courses c ON ce.course_id = c.course_id
         WHERE ce.student_id = $1 AND ce.enrollment_status IN ('Active', 'Enrolled')`,
        [child.student_id]
      );

      // Get attendance
      const attendance = await db.pool.query(
        `SELECT al.log_id, al.scanned_at as timestamp, al.attendance_status as verification_status, c.course_name
         FROM Student_Attendance_Logs al
         LEFT JOIN Courses c ON al.course_id = c.course_id
         WHERE al.student_id = $1
         ORDER BY al.scanned_at DESC LIMIT 100`,
        [child.student_id]
      );

      // Get exam results
      const results = await db.pool.query(
        `SELECT e.exam_name, e.total_marks, e.pass_percentage, er.marks, e.exam_date
         FROM Exam_Results er
         JOIN Exams e ON er.exam_id = e.exam_id
         WHERE er.student_id = $1
         ORDER BY e.exam_date DESC`,
        [child.student_id]
      );

      // Get payments
      const payments = await db.pool.query(
        `SELECT p.payment_id, p.amount_paid as amount, p.amount_paid, p.for_month, p.payment_date, p.payment_status, p.confirmation_url as payment_slip_path, p.confirmation_url, p.receipt_number, p.payment_method, p.student_id, s.student_name, c.course_name
         FROM Payments p
         JOIN Courses c ON p.course_id = c.course_id
         JOIN Students s ON p.student_id = s.student_id
         WHERE p.student_id = $1
         ORDER BY p.payment_date DESC`,
        [child.student_id]
      );

      childrenData.push({
        ...child,
        courses: courses.rows,
        attendance: attendance.rows,
        results: results.rows,
        payments: payments.rows
      });
    }

    res.status(200).json(childrenData);
  } catch (error) {
    console.error('❌ Get My Children Details Error:', error.message);
    res.status(500).json({ message: "ළමුන්ගේ තොරතුරු ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};