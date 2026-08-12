const db = require('../db');
const bcrypt = require('bcryptjs');

const auditService = require('../utils/auditService');
const moodleService = require('../utils/moodleService');

// 💡 Moodle Integration for Teachers
const createMoodleAccount = async (teacherData) => {
  try {
    console.log(`🌐 [Moodle Sync] Creating account for teacher ${teacherData.username}...`);
    const nameParts = teacherData.teacher_name.split(' ');
    const firstname = nameParts[0] || teacherData.username;
    const lastname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Teacher';
    
    const userForMoodle = {
      username: teacherData.username.toLowerCase().replace(/[^a-z0-9]/g, ''),
      password: 'ChangeMe@123',
      firstname: firstname,
      lastname: lastname,
      email: `${teacherData.username.replace(/[^a-zA-Z0-9]/g, '')}@thusitha.edu.lk`
    };
    
    const response = await moodleService.createUser(userForMoodle);
    console.log(`✅ [Moodle Sync] Teacher account created successfully.`);
    if (response && response.length > 0 && response[0].id) {
      return response[0].id;
    }
    return true;
  } catch (error) {
    console.error(`❌ [Moodle Sync] Failed for teacher:`, error.message);
    return null;
  }
};
exports.registerTeacher = async (req, res) => {
  const { username, password, teacher_name, phone, email, specialization, qualifications } = req.body;
  const profile_photo_path = req.file ? `/uploads/${req.file.filename}` : null;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the User record
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const userResult = await client.query(
      'INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
      [username, passwordHash, 'Teacher']
    );
    const userId = userResult.rows[0].user_id;

    // 2. Create the Teacher profile linked to user_id
    const teacherResult = await client.query(
      'INSERT INTO Teachers (user_id, teacher_name, phone, email, specialization, qualifications, profile_photo_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, teacher_name, phone, email, specialization, qualifications, profile_photo_path]
    );

    await client.query('COMMIT');

    // Trigger Moodle Sync
    const moodleUserId = await createMoodleAccount({ username, teacher_name });
    if (moodleUserId && moodleUserId !== true) {
      console.log(`Teacher synced to Moodle with ID ${moodleUserId}`);
      // (Optional) if there was a moodle_user_id column in Teachers, we'd save it here.
    }

    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Teacher', teacherResult.rows[0].teacher_id, `Registered new teacher: ${teacher_name} (User ID: ${userId})`);
    res.status(201).json({ message: 'Teacher registered successfully', teacher: teacherResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Teacher Registration Error:', err.message);
    if (err.code === '23505') { // Postgres unique_violation
      return res.status(409).json({
        message: 'මෙම පරිශීලක නාමය දැනටමත් වෙනත් ගිණුමක් සඳහා භාවිතයේ ඇත. කරුණාකර වෙනත් Username එකක් උත්සාහ කරන්න.',
        error: 'Duplicate username',
        details: err.detail || err.message
      });
    }
    res.status(500).json({ message: 'ගුරුවරයා ලියාපදිංචි කිරීමට නොහැකි විය.', error: 'Failed to register teacher', details: err.message });
  } finally {
    client.release();
  }
};

exports.getAllTeachers = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM Teachers ORDER BY teacher_id DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "ගුරුවරුන් ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

// ගුරුවරයෙක් යාවත්කාලීන කිරීම (Update)
exports.updateTeacher = async (req, res) => {
  const { id } = req.params;
  const { teacher_name, phone, email, specialization, qualifications, bio } = req.body;
  const new_photo_path = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    let query, params;
    if (new_photo_path) {
      query = `
        UPDATE Teachers
        SET teacher_name = $1, phone = $2, email = $3, specialization = $4, qualifications = $5, bio = COALESCE($6, bio), profile_photo_path = $7
        WHERE teacher_id = $8 RETURNING *
      `;
      params = [teacher_name, phone, email, specialization, qualifications, bio || null, new_photo_path, id];
    } else {
      query = `
        UPDATE Teachers
        SET teacher_name = $1, phone = $2, email = $3, specialization = $4, qualifications = $5, bio = COALESCE($6, bio)
        WHERE teacher_id = $7 RETURNING *
      `;
      params = [teacher_name, phone, email, specialization, qualifications, bio || null, id];
    }

    const result = await db.pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ message: 'ගුරුවරයා හමුවුනේ නැත.' });
    
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Teacher', id, `Updated teacher details for ID: ${id}`);
    res.json({ message: 'ගුරු දත්ත සාර්ථකව යාවත්කාලීන කළා!', teacher: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ගුරුවරයෙක් ඉවත් කිරීම (Delete)
exports.deleteTeacher = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query('SELECT user_id FROM Teachers WHERE teacher_id = $1', [id]);
    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].user_id;
      await client.query('DELETE FROM Teachers WHERE teacher_id = $1', [id]);
      await client.query('DELETE FROM Users WHERE user_id = $1', [userId]);
    }
    await client.query('COMMIT');
    await auditService.logAction(req.user.userId, req.user.role, 'DELETE', 'Teacher', id, `Deleted teacher and associated user account ID: ${id}`);
    res.json({ message: 'ගුරුවරයා පද්ධතියෙන් ඉවත් කළා.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
};

exports.getPublicTeachers = async (req, res) => {
  try {
    const result = await db.pool.query(
      'SELECT teacher_id as lecturer_id, teacher_name as lecturer_name, specialization, qualifications, profile_photo_path, bio FROM Teachers ORDER BY teacher_id DESC'
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "දේශකයන්ගේ තොරතුරු ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.getMyStudents = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = `
      SELECT DISTINCT s.*, p.parent_name, p.parent_phone, c.course_name 
      FROM Students s 
      JOIN Course_Enrollments ce ON s.student_id = ce.student_id
      JOIN Courses c ON ce.course_id = c.course_id
      JOIN Teachers t ON c.teacher_id = t.teacher_id
      LEFT JOIN Parents p ON s.parent_id = p.parent_id 
      WHERE t.user_id = $1
      ORDER BY s.student_id DESC
    `;
    const result = await db.pool.query(query, [userId]);
    const formattedStudents = result.rows.map(student => ({
      _id: student.student_id,
      studentId: student.qr_code_key || `ST-${student.user_id}`,
      name: student.student_name || 'Unknown',
      email: student.school || 'N/A',
      parentName: student.parent_name || 'N/A',
      parentPhone: student.parent_phone || 'N/A',
      courseName: student.course_name || 'N/A',
      hasEncoding: !!student.face_encoding,
      hasPhoto: !!student.profile_photo_path,
      photoPath: student.profile_photo_path
    }));
    res.status(200).json(formattedStudents);
  } catch (error) {
    console.error('❌ Get My Students Error:', error.message);
    res.status(500).json({ message: "සිසුන් ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};