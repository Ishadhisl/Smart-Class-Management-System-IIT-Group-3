const db = require('../db');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const fs = require('node:fs');

const auditService = require('../utils/auditService');
const attendanceController = require('./attendanceController');
const { publicUrl } = require('../middleware/imageUpload');
const { defaultPasswordFor } = require('../utils/authDefaults');

const moodleService = require('../utils/moodleService');

// The AI /encode endpoint needs a real file on the shared disk. Profile photos are
// always local ("/uploads/x.jpg").
async function resolvePhotoToLocalPath(photoPath) {
  const absPath = path.resolve(__dirname, '..', photoPath.replace(/^\//, ''));
  return { absPath, cleanup: () => {} };
}

// 💡 Moodle Integration
const createMoodleAccount = async (studentData) => {
  try {
    console.log(`🌐 [Moodle Sync] Creating account for ${studentData.username}...`);
    const nameParts = studentData.student_name.split(' ');
    const firstname = nameParts[0] || studentData.username;
    const lastname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Student';
    
    const studentForMoodle = {
      username: studentData.username,
      password: 'ChangeMe@123',
      firstname: firstname,
      lastname: lastname,
      email: `${studentData.username}@thusitha.edu.lk`
    };
    
    const response = await moodleService.createUser(studentForMoodle);
    console.log(`✅ [Moodle Sync] Account created successfully.`);
    if (response && response.length > 0 && response[0].id) {
      return response[0].id;
    }
    return true;
  } catch (error) {
    console.error(`❌ [Moodle Sync] Failed:`, error.message);
    return null; // Don't crash the main registration if Moodle is down
  }
};

// 🛡️ Logic to pre-calculate face encoding for a student
exports.generateFaceEncoding = async (req, res) => {
  const { studentId } = req.params;
  try {
    const result = await db.pool.query('SELECT profile_photo_path FROM Students WHERE student_id = $1', [studentId]);
    const photoPath = result.rows[0]?.profile_photo_path;

    if (!photoPath) return res.status(400).json({ message: "ශිෂ්‍යයාට ඡායාරූපයක් එක් කර නැත." });

    let resolved;
    try {
      resolved = await resolvePhotoToLocalPath(photoPath);
    } catch (dlErr) {
      console.warn('Photo download failed:', dlErr.message);
      return res.status(400).json({ error: "ඡායාරූප ගොනුව ලබා ගැනීමට නොහැකි විය. කරුණාකර නැවත ඡායාරූපයක් උඩුගත කරන්න." });
    }
    if (!fs.existsSync(resolved.absPath)) {
      resolved.cleanup();
      return res.status(400).json({ error: "ඡායාරූප ගොනුව සේවාදායකයේ හමුවුණේ නැත. කරුණාකර නැවත ඡායාරූපයක් උඩුගත කරන්න." });
    }

    let aiResult;
    try {
      aiResult = await attendanceController.runAIProcess('encode', { image_path: resolved.absPath.replace(/\\/g, '/') });
    } catch (aiErr) {
      console.warn('AI Server is offline or failed:', aiErr.message);
      if (aiErr.message.includes("No face found") || aiErr.message.includes("no face found")) {
        resolved.cleanup();
        return res.status(422).json({ error: "ඡායාරූපයේ මුහුණක් හඳුනා ගැනීමට නොහැකි විය. කරුණාකර වෙනත් පැහැදිලි ඡායාරූපයක් උඩුගත කරන්න." });
      }
      resolved.cleanup();
      return res.status(503).json({ error: 'AI පද්ධතිය ක්‍රියාත්මක නොවේ. කරුණාකර AI සේවාදායකය ක්‍රියාත්මක කරන්න.', ai_offline: true });
    }
    resolved.cleanup();

    if (aiResult.encoding) {
      await db.pool.query('UPDATE Students SET face_encoding = $1 WHERE student_id = $2', [JSON.stringify(aiResult.encoding), studentId]);
      await auditService.logAction(req.user?.userId || null, req.user?.role || 'System', 'UPDATE', 'Student', studentId, 'Pre-calculated face encoding.');
      res.json({ message: 'මුහුණේ දත්ත (Encoding) සාර්ථකව ගණනය කළා!' });
    } else if (aiResult.error) {
      if (aiResult.error.includes("No face found") || aiResult.error.includes("no face found")) {
        return res.status(422).json({ error: "ඡායාරූපයේ මුහුණක් හඳුනා ගැනීමට නොහැකි විය. කරුණාකර වෙනත් පැහැදිලි ඡායාරූපයක් උඩුගත කරන්න." });
      }
      // face_recognition library not installed in the AI container — same user story as "offline"
      if (aiResult.error.includes("not installed")) {
        return res.status(503).json({ error: 'AI පද්ධතිය ක්‍රියාත්මක නොවේ. කරුණාකර AI සේවාදායකය ක්‍රියාත්මක කරන්න.', ai_offline: true });
      }
      return res.status(400).json({ error: aiResult.error });
    } else {
      return res.status(400).json({ error: "මුහුණේ දත්ත ගණනය කිරීමට නොහැකි විය." });
    }
  } catch (err) {
    console.error('Encoding Error:', err.message);
    res.status(500).json({ error: 'Encoding අසාර්ථකයි: ' + err.message });
  }
};

// 🛡️ Logic to pre-calculate face encodings for all students missing them
exports.bulkGenerateEncodings = async (req, res) => {
  try {
    const students = await db.pool.query(
      "SELECT student_id, profile_photo_path FROM Students WHERE profile_photo_path IS NOT NULL AND face_encoding IS NULL"
    );

    if (students.rows.length === 0) {
      return res.json({ message: 'Encoding සඳහා අලුත් ශිෂ්‍යයන් හමුවුනේ නැත.' });
    }

    // Pre-flight: if the AI service isn't reachable (or its face library didn't load),
    // fail loudly instead of running the whole loop and returning a "success" message
    // that actually encoded nobody.
    try {
      const aiStatus = await attendanceController.runAIProcess('status', {});
      if (aiStatus && aiStatus.face_rec_enabled === false) {
        return res.status(503).json({
          error: 'AI පද්ධතිය ක්‍රියාත්මක නොවේ. කරුණාකර AI සේවාදායකය ක්‍රියාත්මක කරන්න.',
          ai_offline: true
        });
      }
    } catch (aiErr) {
      console.warn('Bulk encode aborted — AI service offline:', aiErr.message);
      return res.status(503).json({
        error: 'AI පද්ධතිය ක්‍රියාත්මක නොවේ. කරුණාකර AI සේවාදායකය ක්‍රියාත්මක කරන්න.',
        ai_offline: true
      });
    }

    let successCount = 0;
    let failCount = 0;
    let missingPhotoCount = 0;

    for (const student of students.rows) {
      let resolved = null;
      try {
        resolved = await resolvePhotoToLocalPath(student.profile_photo_path);
        if (!fs.existsSync(resolved.absPath)) {
          console.warn(`File missing for student_id=${student.student_id}:`, resolved.absPath);
          missingPhotoCount++;
          failCount++;
          continue;
        }
        const aiResult = await attendanceController.runAIProcess('encode', { image_path: resolved.absPath.replace(/\\/g, '/') });
        if (aiResult.encoding) {
          await db.pool.query('UPDATE Students SET face_encoding = $1 WHERE student_id = $2', [JSON.stringify(aiResult.encoding), student.student_id]);
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`Encoding failed for student_id=${student.student_id}:`, err.message);
        failCount++;
      } finally {
        if (resolved) resolved.cleanup();
      }
    }

    await auditService.logAction(req.user?.userId || null, req.user?.role || 'System', 'UPDATE', 'Student', null, `Bulk encoded ${successCount} students.`);
    let msg = `සාර්ථකයි! සිසුන් ${successCount} දෙනෙකුගේ දත්ත ගණනය කළා. අසාර්ථක: ${failCount}`;
    if (missingPhotoCount > 0) {
      msg += ` (ඡායාරූප ගොනු නොමැති සිසුන්: ${missingPhotoCount})`;
    }
    res.json({ message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Bulk Encoding අසාර්ථකයි: ' + err.message });
  }
};

// Public Registration (Adds to a pending queue)
exports.publicRegistration = async (req, res) => {
  const { student_name, school, grade, parent_phone, email, course_id } = req.body;
  try {
    const query = `
      INSERT INTO PendingRegistrations (name, school, grade, phone, email, course_interest, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'Pending') RETURNING id
    `;
    const result = await db.pool.query(query, [student_name, school, grade, parent_phone, email, course_id || null]);
    res.status(201).json({ message: 'ලියාපදිංචිය සාර්ථකයි! කරුණාකර අනුමැතිය සඳහා කාර්යාලයට පැමිණෙන්න.', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'දත්ත ඇතුළත් කිරීමේ දෝෂයකි.', details: err.message });
  }
};

// ලබා නොදුන් අනුමැතීන් සහිත සිසුන් ලැයිස්තුව ලබා ගැනීම
exports.getPendingRegistrations = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM PendingRegistrations WHERE status = $1 ORDER BY id DESC', ['Pending']);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get Pending Registrations Error:', err.message);
    res.status(500).json({ error: 'දත්ත ලබා ගැනීමට නොහැකි විය.' });
  }
};

// Approve and Create Account (Counter Person Action)
exports.approveStudent = async (req, res) => {
  const { pending_id, qr_code_key, parent_id } = req.body;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch pending data
    const pending = await client.query('SELECT * FROM PendingRegistrations WHERE id = $1', [pending_id]);
    if (pending.rows.length === 0) throw new Error('වාර්තාව හමුවුනේ නැත.');
    const s = pending.rows[0];

    // 2. Create System User
    const username = qr_code_key; // Using QR key as username ensures uniqueness for siblings sharing parent contact info
    const passwordHash = await bcrypt.hash(defaultPasswordFor('Student'), 10); // Default password
    const userRes = await client.query(
      'INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
      [username, passwordHash, 'Student']
    );
    const userId = userRes.rows[0].user_id;

    // 3. Create Real Student Profile
    const studentRes = await client.query(
      'INSERT INTO Students (user_id, parent_id, student_name, school, grade, qr_code_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING student_id',
      [userId, parent_id || null, s.name, s.school, s.grade, qr_code_key]
    );

    // 4. Clean up pending table
    await client.query('DELETE FROM PendingRegistrations WHERE id = $1', [pending_id]);

    await client.query('COMMIT');

    // Post-processing
    const studentId = studentRes.rows[0].student_id;
    const moodleUserId = await createMoodleAccount({ username, student_name: s.name });
    if (moodleUserId && moodleUserId !== true) {
      await db.pool.query('UPDATE Students SET moodle_user_id = $1 WHERE student_id = $2', [moodleUserId, studentId]);
      // Attempt auto-enrollment if a course was selected. course_interest is an SCMS
      // course_id, not a Moodle course id - it must be resolved (and provisioned in
      // Moodle if this is the first student enrolling in it), not used directly.
      if (s.course_interest) {
        try {
          const courseRes = await db.pool.query('SELECT course_name FROM Courses WHERE course_id = $1', [s.course_interest]);
          const moodleCourse = await moodleService.findOrCreateCourse(s.course_interest, courseRes.rows[0]?.course_name);
          if (moodleCourse && moodleCourse.id) {
            await moodleService.enrollUser(moodleUserId, moodleCourse.id);
            console.log(`✅ [Moodle Sync] Auto-enrolled in course ${s.course_interest} (Moodle course ${moodleCourse.id})`);
          }
        } catch (e) {
          console.error(`❌ [Moodle Sync] Auto-enrollment failed:`, e.message);
        }
      }
    }
    await auditService.logAction(req.user.userId, req.user.role, 'APPROVE', 'Student', studentId, `Approved registration for ${s.name}`);

    res.json({ message: 'ශිෂ්‍ය ගිණුම සාර්ථකව සක්‍රිය කරන ලදී!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
};

// ශිෂ්‍යයෙක් ලියාපදිංචි කිරීම
exports.registerStudent = async (req, res) => {
  const { username, password, student_name, school, grade, qr_code_key, parent_id, parent_name, parent_phone, address } = req.body;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Blank password => role default (Student@123); login then flags must_change_password.
    const passwordHash = await bcrypt.hash(password || defaultPasswordFor('Student'), 10);

    // Resolve parent_id
    let finalParentId = parent_id || null;
    if (!finalParentId && parent_name && parent_phone) {
      const existingParent = await client.query('SELECT parent_id FROM Parents WHERE parent_phone = $1', [parent_phone]);
      if (existingParent.rows.length > 0) {
        finalParentId = existingParent.rows[0].parent_id;
      } else {
        const parentPasswordHash = await bcrypt.hash(defaultPasswordFor('Parent'), 10);
        const parentUserResult = await client.query(
          'INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
          [parent_phone, parentPasswordHash, 'Parent']
        );
        const parentUserId = parentUserResult.rows[0].user_id;
        const parentResult = await client.query(
          'INSERT INTO Parents (user_id, parent_name, parent_phone) VALUES ($1, $2, $3) RETURNING parent_id',
          [parentUserId, parent_name, parent_phone]
        );
        finalParentId = parentResult.rows[0].parent_id;
      }
    }

    const userResult = await client.query(
      'INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
      [username, passwordHash, 'Student']
    );
    const userId = userResult.rows[0].user_id;

    const studentResult = await client.query(
      'INSERT INTO Students (user_id, parent_id, student_name, school, grade, qr_code_key, address) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, finalParentId, student_name, school, grade, qr_code_key, address || null]
    );

    await client.query('COMMIT');
    
    // Trigger Moodle Sync
    const studentId = studentResult.rows[0].student_id;
    const moodleUserId = await createMoodleAccount({ username, student_name });
    if (moodleUserId && moodleUserId !== true) {
      await db.pool.query('UPDATE Students SET moodle_user_id = $1 WHERE student_id = $2', [moodleUserId, studentId]);
    }

    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Student', studentId, `Registered new student: ${student_name} (User ID: ${userId})`);
    res.status(201).json({ message: 'Student registered successfully', student: studentResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Student Registration Error:', err.message);
    if (err.code === '23505') { // Postgres unique_violation
      return res.status(409).json({
        message: 'මෙම පරිශීලක නාමය හෝ දෙමාපිය දුරකථන අංකය දැනටමත් වෙනත් ගිණුමක් සඳහා භාවිතයේ ඇත. කරුණාකර වෙනත් අගයක් උත්සාහ කරන්න.',
        error: 'Duplicate username',
        details: err.detail || err.message
      });
    }
    res.status(500).json({ error: 'Failed to register student', details: err.message });
  } finally {
    client.release();
  }
};

// ශිෂ්‍ය දත්ත යාවත්කාලීන කිරීම (Update)
exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { student_name, school, grade, parent_name, parent_phone, address } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Update student details
    const studentQuery = `
      UPDATE Students 
      SET student_name = $1, school = $2, grade = $3, address = COALESCE($4, address)
      WHERE student_id = $5 RETURNING *
    `;
    const result = await client.query(studentQuery, [student_name, school, grade, address || null, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'ශිෂ්‍යයා හමුවුනේ නැත.' });
    }

    // Update parent details if provided
    if (parent_name || parent_phone) {
      const parentIdRes = await client.query('SELECT parent_id FROM Students WHERE student_id = $1', [id]);
      const parentId = parentIdRes.rows[0]?.parent_id;
      if (parentId) {
        await client.query(
          `UPDATE Parents SET 
            parent_name = COALESCE($1, parent_name),
            parent_phone = COALESCE($2, parent_phone)
          WHERE parent_id = $3`,
          [parent_name || null, parent_phone || null, parentId]
        );
      }
    }

    await client.query('COMMIT');
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Student', id, `Updated student + parent details for ID: ${id}`);
    res.json({ message: 'දත්ත සාර්ථකව යාවත්කාලීන කළා!', student: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ශිෂ්‍යයෙක් ඉවත් කිරීම (Delete)
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Get user_id first to delete from Users table too
    const userRes = await client.query('SELECT user_id FROM Students WHERE student_id = $1', [id]);
    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].user_id;
      await client.query('DELETE FROM Students WHERE student_id = $1', [id]);
      await client.query('DELETE FROM Users WHERE user_id = $1', [userId]);
    }
    await client.query('COMMIT');
    await auditService.logAction(req.user.userId, req.user.role, 'DELETE', 'Student', id, `Deleted student and associated user account ID: ${id}`);
    res.json({ message: 'ශිෂ්‍යයා පද්ධතියෙන් ඉවත් කළා.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
};

// ඩේටාබේස් එකෙන් සියලුම සිසුන් Dashboard එකට ලබා දීම
exports.getAllStudents = async (req, res) => {
  try {
    const query = `
      SELECT s.*, p.parent_name, p.parent_phone 
      FROM Students s 
      LEFT JOIN Parents p ON s.parent_id = p.parent_id 
      ORDER BY s.student_id DESC
    `;
    const result = await db.pool.query(query);

    // Fetch enrollments
    const enrollmentsRes = await db.pool.query(
      "SELECT student_id, course_id FROM Course_Enrollments WHERE enrollment_status = 'Active'"
    );
    const enrollmentsMap = {};
    enrollmentsRes.rows.forEach(row => {
      if (!enrollmentsMap[row.student_id]) {
        enrollmentsMap[row.student_id] = [];
      }
      enrollmentsMap[row.student_id].push(row.course_id);
    });

    const formattedStudents = result.rows.map(student => ({
      _id: student.student_id,
      studentId: student.qr_code_key || `ST-${student.user_id}`,
      name: student.student_name || 'Unknown',
      email: student.school || 'N/A',
      parentName: student.parent_name || 'N/A',
      parentPhone: student.parent_phone || 'N/A',
      hasEncoding: !!student.face_encoding,
      hasPhoto: !!student.profile_photo_path,
      photoPath: student.profile_photo_path,
      courseIds: enrollmentsMap[student.student_id] || [],
      address: student.address || ''
    }));
    res.status(200).json(formattedStudents);
  } catch (error) {
    console.error('❌ Get All Students Error:', error.message);
    res.status(500).json({ message: "සිසුන් ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

// ලොග් වී සිටින සිසුවාගේම ප්‍රොෆයිල් දත්ත ලබා දීම (photo path only)
exports.getMyProfile = async (req, res) => {
  try {
    const result = await db.pool.query(
      'SELECT student_id, student_name, profile_photo_path FROM Students WHERE user_id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ශිෂ්‍ය දත්ත හමුවුනේ නැත.' });
    }
    const student = result.rows[0];
    res.json({
      student_id: student.student_id,
      student_name: student.student_name,
      profile_photo_path: student.profile_photo_path || null
    });
  } catch (err) {
    console.error('❌ Get My Profile Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🛡️ Upload profile photo
exports.uploadPhoto = async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: "ඡායාරූපයක් තෝරා නැත." });
  }
  // Face encoding is cleared so it's regenerated from the new photo on the next encode run.
  const photoPath = publicUrl(req.file);
  try {
    const result = await db.pool.query(
      'UPDATE Students SET profile_photo_path = $1, face_encoding = NULL WHERE student_id = $2 RETURNING *',
      [photoPath, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "ශිෂ්‍යයා හමුවුනේ නැත." });
    }
    await auditService.logAction(req.user?.userId, req.user?.role, 'UPDATE', 'Student', id, `Uploaded profile photo: ${photoPath}`);
    res.json({ message: "ඡායාරූපය සාර්ථකව උඩුගත කළා!", photo_path: photoPath });
  } catch (err) {
    console.error('❌ Photo Upload Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};