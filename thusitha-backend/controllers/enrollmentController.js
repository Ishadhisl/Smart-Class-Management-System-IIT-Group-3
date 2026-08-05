const db = require('../db');
const auditService = require('../utils/auditService');

exports.enrollStudent = async (req, res) => {
  const { student_id, course_id } = req.body;

  if (!student_id || !course_id) {
    return res.status(400).json({ message: "ශිෂ්‍යයා සහ පන්තිය යන දෙකම තෝරන්න." });
  }

  try {
    // Check if enrollment already exists
    const checkQuery = 'SELECT * FROM Course_Enrollments WHERE student_id = $1 AND course_id = $2';
    const existing = await db.pool.query(checkQuery, [student_id, course_id]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "මෙම ශිෂ්‍යයා දැනටමත් මෙම පන්තියට ඇතුළත් කර ඇත." });
    }

    const insertQuery = `
      INSERT INTO Course_Enrollments (student_id, course_id, enrollment_status) 
      VALUES ($1, $2, 'Enrolled') 
      RETURNING *
    `;
    const result = await db.pool.query(insertQuery, [student_id, course_id]);

    res.status(201).json({
      message: 'Student enrolled successfully',
      enrollment: result.rows[0]
    });
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Course_Enrollment', result.rows[0].enrollment_id, `Enrolled student ${student_id} into course ${course_id}.`);
  } catch (error) {
    console.error('Enrollment Error:', error.message);
    res.status(500).json({ message: "ශිෂ්‍යයා පන්තියට ඇතුළත් කිරීම අසාර්ථකයි.", error: error.message });
  }
};

exports.getEnrollmentsByCourse = async (req, res) => {
  const { courseId } = req.params;
  try {
    const query = `
      SELECT e.*, s.student_name, s.qr_code_key 
      FROM Course_Enrollments e
      JOIN Students s ON e.student_id = s.student_id
      WHERE e.course_id = $1
    `;
    const result = await db.pool.query(query, [courseId]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "පන්තියේ ශිෂ්‍ය ලැයිස්තුව ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.getMyEnrolledCourses = async (req, res) => {
  try {
    const studentQuery = 'SELECT student_id FROM Students WHERE user_id = $1';
    const studentRes = await db.pool.query(studentQuery, [req.user.userId]);

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ message: "ශිෂ්‍ය ගිණුම සොයාගත නොහැකි විය." });
    }

    const studentId = studentRes.rows[0].student_id;
    const coursesQuery = `
      SELECT c.* 
      FROM Course_Enrollments e
      JOIN Courses c ON e.course_id = c.course_id
      WHERE e.student_id = $1 AND e.enrollment_status = 'Enrolled'
      ORDER BY c.course_name ASC
    `;
    const result = await db.pool.query(coursesQuery, [studentId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get Enrolled Courses Error:', error.message);
    res.status(500).json({ message: "ලියාපදිංචි වී ඇති පන්ති දත්ත ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};