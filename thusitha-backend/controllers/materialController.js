const db = require('../db');
const fs = require('node:fs');
const path = require('node:path');
const auditService = require('../utils/auditService');

exports.uploadMaterial = async (req, res) => {
  const { course_id, material_title } = req.body;

  if (!req.file || !course_id || !material_title) {
    return res.status(400).json({ message: "විෂය දත්ත සහ ගොනුව අනිවාර්ය වේ." });
  }

  // Enforce PDF only check
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: "PDF ගොනු පමණක් උඩුගත කළ හැක. (Only PDF files are allowed)" });
  }

  try {
    // Get teacher_id of the course from Courses table to satisfy foreign key constraint
    const courseQuery = 'SELECT teacher_id FROM Courses WHERE course_id = $1';
    const courseRes = await db.pool.query(courseQuery, [course_id]);
    if (courseRes.rows.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "විෂය දත්ත සොයාගත නොහැකි විය." });
    }
    const teacher_id = courseRes.rows[0].teacher_id;

    const query = `
      INSERT INTO Learning_Materials (course_id, teacher_id, material_title, material_type, uploaded_file)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    // Store the path relative to the root for serving static files later
    const result = await db.pool.query(query, [course_id, teacher_id, material_title, 'PDF', `uploads/${req.file.filename}`]);
    
    await auditService.logAction(req.user.userId, req.user.role, 'FILE_UPLOAD', 'Learning_Material', result.rows[0].material_id, `Uploaded new material: ${material_title} for course ${course_id}.`);
    res.status(201).json({ message: 'ගොනුව සාර්ථකව උඩුගත කරන ලදී.', material: result.rows[0] });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('❌ Material Upload Error:', error.message);
    res.status(500).json({ error: 'ගොනුව උඩුගත කිරීම අසාර්ථකයි.' });
  }
};

exports.getCourseMaterials = async (req, res) => {
  const { courseId } = req.params;
  try {
    // If the logged in user is a Student, verify they are enrolled in this course
    if (req.user.role === 'Student') {
      const studentQuery = 'SELECT student_id FROM Students WHERE user_id = $1';
      const studentRes = await db.pool.query(studentQuery, [req.user.userId]);
      if (studentRes.rows.length === 0) {
        return res.status(403).json({ message: "ප්‍රවේශය තහනම්ය (Access denied)." });
      }
      const studentId = studentRes.rows[0].student_id;
      const checkEnrollQuery = `
        SELECT 1 FROM Course_Enrollments 
        WHERE student_id = $1 AND course_id = $2 AND enrollment_status = 'Enrolled'
      `;
      const enrollCheck = await db.pool.query(checkEnrollQuery, [studentId, courseId]);
      if (enrollCheck.rows.length === 0) {
        return res.status(403).json({ message: "ඔබ මෙම පන්තියට ලියාපදිංචි වී නැත. (You are not enrolled in this course)" });
      }
    }

    const query = `
      SELECT m.*, t.teacher_name 
      FROM Learning_Materials m
      JOIN Teachers t ON m.teacher_id = t.teacher_id
      WHERE m.course_id = $1 AND m.material_type = 'PDF'
      ORDER BY m.uploaded_at DESC
    `;
    const result = await db.pool.query(query, [courseId]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};