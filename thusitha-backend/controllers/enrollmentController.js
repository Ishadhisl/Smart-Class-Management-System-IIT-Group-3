const db = require('../db');
const auditService = require('../utils/auditService');
const moodleService = require('../utils/moodleService');

// Best-effort: mirrors an SCMS enrollment into Moodle so the student can actually see the
// course's materials there. Must never affect the SCMS enrollment itself if Moodle is down
// or a lookup fails - errors are logged and swallowed, same pattern used for Moodle syncs
// elsewhere in this codebase (student/teacher registration).
const syncEnrollmentToMoodle = async (studentId, courseId) => {
  try {
    const studentRes = await db.pool.query(
      `SELECT s.student_name, u.username FROM Students s JOIN Users u ON s.user_id = u.user_id WHERE s.student_id = $1`,
      [studentId]
    );
    const courseRes = await db.pool.query('SELECT course_name FROM Courses WHERE course_id = $1', [courseId]);
    if (studentRes.rows.length === 0 || courseRes.rows.length === 0) return;

    const { student_name, username } = studentRes.rows[0];
    const moodleUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameParts = student_name.split(' ');

    const moodleUser = await moodleService.findOrCreateUser({
      username: moodleUsername,
      firstname: nameParts[0] || moodleUsername,
      lastname: nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Student',
      email: `${moodleUsername}@thusitha.edu.lk`
    });
    const moodleCourse = await moodleService.findOrCreateCourse(courseId, courseRes.rows[0].course_name);

    if (moodleUser && moodleUser.id && moodleCourse && moodleCourse.id) {
      await moodleService.enrollUser(moodleUser.id, moodleCourse.id);
      console.log(`✅ [Moodle Sync] Enrolled ${username} into course ${courseId} (Moodle course ${moodleCourse.id})`);
    }
  } catch (err) {
    console.error('❌ [Moodle Sync] Enrollment sync failed:', err.message);
  }
};

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

    // Check enrollment capacity against hall capacity (Warning only, do not block)
    let warningMessage = null;
    const capacityQuery = `
      SELECT h.capacity, 
        (SELECT COUNT(*) FROM Course_Enrollments ce 
         WHERE ce.course_id = $1 AND ce.enrollment_status IN ('Enrolled', 'Active')) as current_count
      FROM Class_Schedules cs
      JOIN Halls h ON cs.hall_id = h.hall_id
      WHERE cs.course_id = $1
      LIMIT 1
    `;
    const capacityResult = await db.pool.query(capacityQuery, [course_id]);
    if (capacityResult.rows.length > 0) {
      const { capacity, current_count } = capacityResult.rows[0];
      if (Number(current_count) >= Number(capacity)) {
        warningMessage = `අවධානයට: මෙම පන්තියේ වත්මන් ශාලාවේ උපරිම ධාරිතාව (${capacity}) ඉක්මවා ඇත. කරුණාකර විශාල ශාලාවකට පන්තිය මාරු කරන්න.`;
      }
    }

    const insertQuery = `
      INSERT INTO Course_Enrollments (student_id, course_id, enrollment_status) 
      VALUES ($1, $2, 'Enrolled') 
      RETURNING *
    `;
    const result = await db.pool.query(insertQuery, [student_id, course_id]);

    res.status(201).json({
      message: warningMessage ? `Student enrolled successfully. ${warningMessage}` : 'Student enrolled successfully',
      warning: warningMessage,
      enrollment: result.rows[0]
    });
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Course_Enrollment', result.rows[0].enrollment_id, `Enrolled student ${student_id} into course ${course_id}.`);
    syncEnrollmentToMoodle(student_id, course_id);
  } catch (error) {
    console.error('❌ Enrollment Error:', error.message);
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
      WHERE e.student_id = $1 AND e.enrollment_status IN ('Enrolled', 'Active')
      ORDER BY c.course_name ASC
    `;
    const result = await db.pool.query(coursesQuery, [studentId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get Enrolled Courses Error:', error.message);
    res.status(500).json({ message: "ලියාපදිංචි වී ඇති පන්ති දත්ත ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};