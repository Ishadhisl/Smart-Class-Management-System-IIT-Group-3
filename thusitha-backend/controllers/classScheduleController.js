const db = require('../db');
const auditService = require('../utils/auditService');

// Helper function to check for time conflicts
const checkConflict = async (client, { hall_id, lecturer_id, day_of_week, start_time, end_time, exclude_schedule_id = null }) => {
  const conflictQuery = `
    SELECT 
      cs.schedule_id,
      c.course_name as class_name,
      h.hall_name,
      l.teacher_name as lecturer_name
    FROM Class_Schedules cs
    LEFT JOIN Courses c ON cs.course_id = c.course_id
    LEFT JOIN Halls h ON cs.hall_id = h.hall_id
    LEFT JOIN Teachers l ON c.teacher_id = l.teacher_id
    WHERE 
      cs.day_of_week = $1 -- Check for overlapping days
      AND (
        (cs.start_time < $3 AND cs.end_time > $2) OR -- New schedule starts before existing ends and ends after existing starts
        (cs.start_time >= $2 AND cs.start_time < $3) OR -- New schedule starts within existing
        (cs.end_time > $2 AND cs.end_time <= $3) -- New schedule ends within existing
      )
      AND (cs.hall_id = $4 OR (c.teacher_id IS NOT NULL AND c.teacher_id = $5))
      ${exclude_schedule_id ? `AND cs.schedule_id != ${exclude_schedule_id}` : ''}
    LIMIT 1;
  `;

  const conflictResult = await client.query(conflictQuery, [day_of_week, start_time, end_time, hall_id, lecturer_id]);
  return conflictResult.rows[0];
};

// Create a new class schedule
exports.createClassSchedule = async (req, res) => {
  const { course_id, subject_id, lecturer_id, hall_id, day_of_week, start_time, end_time, class_name, capacity } = req.body;

  if (!course_id || !subject_id || !lecturer_id || !hall_id || !day_of_week || !start_time || !end_time || !class_name || !capacity) {
    return res.status(400).json({ error: 'සියලුම ක්ෂේත්‍ර සම්පූර්ණ කරන්න.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedDay = Array.isArray(day_of_week) ? day_of_week[0] : day_of_week;

    // 💡 Conflict Prevention Logic
    const conflict = await checkConflict(client, { hall_id, lecturer_id, day_of_week: normalizedDay, start_time, end_time });
    if (conflict) {
      return res.status(409).json({ error: `කාලසටහන ගැටුමක් ඇත: ${conflict.class_name} (${conflict.lecturer_name} / ${conflict.hall_name})` });
    }

    const query = `
      INSERT INTO Class_Schedules (course_id, hall_id, day_of_week, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await client.query(query, [course_id, hall_id, normalizedDay, start_time, end_time]);

    // Update the associated course with the selected teacher and subject
    await client.query(
      'UPDATE Courses SET teacher_id = $1, subject_id = $2 WHERE course_id = $3',
      [lecturer_id, subject_id, course_id]
    );

    const populatedQuery = `
      SELECT 
        cs.schedule_id,
        cs.day_of_week,
        cs.start_time,
        cs.end_time,
        c.course_name,
        c.course_name as class_name,
        s.subject_name,
        l.teacher_name as lecturer_name,
        h.hall_name,
        h.capacity as capacity,
        cs.course_id, c.subject_id, c.teacher_id as lecturer_id, cs.hall_id
      FROM Class_Schedules cs
      LEFT JOIN Courses c ON cs.course_id = c.course_id
      LEFT JOIN Subjects s ON c.subject_id = s.subject_id
      LEFT JOIN Teachers l ON c.teacher_id = l.teacher_id
      LEFT JOIN Halls h ON cs.hall_id = h.hall_id
      WHERE cs.schedule_id = $1
    `;
    const populatedResult = await client.query(populatedQuery, [result.rows[0].schedule_id]);

    await client.query('COMMIT');
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Class_Schedule', result.rows[0].schedule_id, `Created class schedule: ${class_name}`);
    res.status(201).json({ message: 'පන්ති කාලසටහන සාර්ථව නිර්මාණය කළා!', schedule: populatedResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Create Class Schedule Error:', err.message);
    res.status(500).json({ error: 'කාලසටහන නිර්මාණය කිරීම අසාර්ථකයි.' });
  } finally {
    client.release();
  }
};

// Get all class schedules with joined data
exports.getAllClassSchedules = async (req, res) => {
  try {
    const query = `
      SELECT 
        cs.schedule_id,
        cs.day_of_week,
        cs.start_time,
        cs.end_time,
        c.course_name,
        c.course_name as class_name,
        s.subject_name,
        l.teacher_name as lecturer_name,
        h.hall_name,
        h.capacity as capacity,
        cs.course_id, c.subject_id, c.teacher_id as lecturer_id, cs.hall_id
      FROM Class_Schedules cs
      LEFT JOIN Courses c ON cs.course_id = c.course_id
      LEFT JOIN Subjects s ON c.subject_id = s.subject_id
      LEFT JOIN Teachers l ON c.teacher_id = l.teacher_id
      LEFT JOIN Halls h ON cs.hall_id = h.hall_id
      ORDER BY cs.day_of_week, cs.start_time ASC
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get All Class Schedules Error:', err.message);
    res.status(500).json({ error: 'කාලසටහන් දත්ත ලබා ගැනීමට නොහැකි විය.' });
  }
};

// Update a class schedule
exports.updateClassSchedule = async (req, res) => {
  const { id } = req.params;
  const { course_id, subject_id, lecturer_id, hall_id, day_of_week, start_time, end_time, class_name, capacity } = req.body;

  if (!course_id || !subject_id || !lecturer_id || !hall_id || !day_of_week || !start_time || !end_time || !class_name || !capacity) {
    return res.status(400).json({ error: 'සියලුම ක්ෂේත්‍ර සම්පූර්ණ කරන්න.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedDay = Array.isArray(day_of_week) ? day_of_week[0] : day_of_week;

    // 💡 Conflict Prevention Logic (excluding current schedule)
    const conflict = await checkConflict(client, { hall_id, lecturer_id, day_of_week: normalizedDay, start_time, end_time, exclude_schedule_id: id });
    if (conflict) {
      return res.status(409).json({ error: `කාලසටහන ගැටුමක් ඇත: ${conflict.class_name} (${conflict.lecturer_name} / ${conflict.hall_name})` });
    }

    const query = `
      UPDATE Class_Schedules SET course_id = $1, hall_id = $2, day_of_week = $3, start_time = $4, end_time = $5
      WHERE schedule_id = $6 RETURNING *
    `;
    const result = await client.query(query, [course_id, hall_id, normalizedDay, start_time, end_time, id]);

    if (result.rows.length === 0) throw new Error('කාලසටහන හමුවුනේ නැත.');

    // Update the associated course with the selected teacher and subject
    await client.query(
      'UPDATE Courses SET teacher_id = $1, subject_id = $2 WHERE course_id = $3',
      [lecturer_id, subject_id, course_id]
    );

    const populatedQuery = `
      SELECT 
        cs.schedule_id,
        cs.day_of_week,
        cs.start_time,
        cs.end_time,
        c.course_name,
        c.course_name as class_name,
        s.subject_name,
        l.teacher_name as lecturer_name,
        h.hall_name,
        h.capacity as capacity,
        cs.course_id, c.subject_id, c.teacher_id as lecturer_id, cs.hall_id
      FROM Class_Schedules cs
      LEFT JOIN Courses c ON cs.course_id = c.course_id
      LEFT JOIN Subjects s ON c.subject_id = s.subject_id
      LEFT JOIN Teachers l ON c.teacher_id = l.teacher_id
      LEFT JOIN Halls h ON cs.hall_id = h.hall_id
      WHERE cs.schedule_id = $1
    `;
    const populatedResult = await client.query(populatedQuery, [id]);

    await client.query('COMMIT');
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Class_Schedule', id, `Updated class schedule: ${class_name}`);
    res.json({ message: 'පන්ති කාලසටහන සාර්ථකව යාවත්කාලීන කළා!', schedule: populatedResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Update Class Schedule Error:', err.message);
    res.status(500).json({ error: 'කාලසටහන යාවත්කාලීන කිරීම අසාර්ථකයි.' });
  } finally {
    client.release();
  }
};

// Delete a class schedule
exports.deleteClassSchedule = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query('DELETE FROM Class_Schedules WHERE schedule_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) throw new Error('කාලසටහන හමුවුනේ නැත.');

    await auditService.logAction(req.user.userId, req.user.role, 'DELETE', 'Class_Schedule', id, `Deleted class schedule ID: ${id}`);
    res.json({ message: 'පන්ති කාලසටහන සාර්ථකව ඉවත් කළා!' });
  } catch (err) {
    console.error('❌ Delete Class Schedule Error:', err.message);
    res.status(500).json({ error: 'කාලසටහන ඉවත් කිරීම අසාර්ථකයි.' });
  }
};

// පුද්ගලීකරණය කළ කාලසටහන ලබා ගැනීම (For Teachers and Students)
exports.getPersonalizedSchedule = async (req, res) => {
  const userId = req.user.userId;
  const role = req.user.role;
  let query = '';
  let params = [userId];

  if (role === 'Teacher') {
    query = `
      SELECT cs.*, c.course_name, s.subject_name, h.hall_name, l.teacher_name as lecturer_name
      FROM Class_Schedules cs
      JOIN Courses c ON cs.course_id = c.course_id
      JOIN Teachers l ON c.teacher_id = l.teacher_id
      JOIN Subjects s ON c.subject_id = s.subject_id
      JOIN Halls h ON cs.hall_id = h.hall_id
      WHERE l.user_id = $1
      ORDER BY cs.day_of_week, cs.start_time;
    `;
  } else if (role === 'Student') {
    query = `
      SELECT cs.*, c.course_name, s.subject_name, h.hall_name, l.teacher_name as lecturer_name
      FROM Class_Schedules cs
      JOIN Course_Enrollments ce ON cs.course_id = ce.course_id
      JOIN Students st ON ce.student_id = st.student_id
      JOIN Courses c ON cs.course_id = c.course_id
      JOIN Subjects s ON c.subject_id = s.subject_id
      JOIN Halls h ON cs.hall_id = h.hall_id
      JOIN Teachers l ON c.teacher_id = l.teacher_id
      WHERE st.user_id = $1 AND ce.enrollment_status = 'Enrolled'
      ORDER BY cs.day_of_week, cs.start_time;
    `;
  } else {
    return res.status(403).json({ error: 'අනවසර ප්‍රවේශයකි.' });
  }

  try {
    const result = await db.pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get Personalized Schedule Error:', err.message);
    res.status(500).json({ error: 'කාලසටහන ලබා ගැනීමට නොහැකි විය.' });
  }
};
