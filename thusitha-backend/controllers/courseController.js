const db = require('../db');
const auditService = require('../utils/auditService');

// ඩේටාබේස් එකෙන් සියලුම පන්ති ලබා දීම (active only by default)
exports.getAllCourses = async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const query = includeInactive
      ? 'SELECT * FROM Courses ORDER BY course_name ASC'
      : "SELECT * FROM Courses WHERE is_active = true ORDER BY course_name ASC";
    const result = await db.pool.query(query);
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get All Courses Error:', error.message);
    res.status(500).json({ message: "පන්ති දත්ත ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.createCourse = async (req, res) => {
  const { course_name, monthly_fee, teacher_id, subject_id } = req.body;

  // Input validation
  if (!course_name || !course_name.trim()) {
    return res.status(400).json({ message: 'පාඨමාලා නම අවශ්‍ය වේ.' });
  }
  if (!monthly_fee || isNaN(monthly_fee) || Number(monthly_fee) <= 0) {
    return res.status(400).json({ message: 'මාසික ගාස්තුව ධන සංඛ්‍යාවක් විය යුතුය.' });
  }

  try {
    const query = 'INSERT INTO Courses (course_name, monthly_fee, teacher_id, subject_id) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await db.pool.query(query, [course_name.trim(), Number(monthly_fee), teacher_id || null, subject_id || null]);
    
    await auditService.logAction(req.user?.userId, req.user?.role, 'CREATE', 'Course', result.rows[0].course_id, `Course "${course_name}" created.`);
    res.status(201).json({ message: 'පාඨමාලාව සාර්ථකව එකතු කළා!', course: result.rows[0] });
  } catch (error) {
    console.error('❌ Create Course Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Soft-delete: mark course as inactive instead of permanent deletion
exports.deleteCourse = async (req, res) => {
  const { id } = req.params;
  try {
    // Check if course exists
    const courseCheck = await db.pool.query('SELECT * FROM Courses WHERE course_id = $1', [id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ message: 'පාඨමාලාව හමුවුනේ නැත.' });
    }

    // Soft-delete: set is_active = false
    await db.pool.query('UPDATE Courses SET is_active = false WHERE course_id = $1', [id]);
    
    await auditService.logAction(req.user?.userId, req.user?.role, 'SOFT_DELETE', 'Course', id, `Course "${courseCheck.rows[0].course_name}" deactivated.`);
    res.json({ message: 'පාඨමාලාව සාර්ථකව අක්‍රිය කළා!' });
  } catch (error) {
    console.error('❌ Delete Course Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Restore a soft-deleted course
exports.restoreCourse = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query(
      'UPDATE Courses SET is_active = true WHERE course_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'පාඨමාලාව හමුවුනේ නැත.' });
    }
    await auditService.logAction(req.user?.userId, req.user?.role, 'RESTORE', 'Course', id, `Course "${result.rows[0].course_name}" reactivated.`);
    res.json({ message: 'පාඨමාලාව සාර්ථකව ප්‍රතිසාධනය කළා!', course: result.rows[0] });
  } catch (error) {
    console.error('❌ Restore Course Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  const { id } = req.params;
  const { course_name, monthly_fee, teacher_id, subject_id } = req.body;

  // Input validation
  if (!course_name || !course_name.trim()) {
    return res.status(400).json({ message: 'පාඨමාලා නම අවශ්‍ය වේ.' });
  }
  if (!monthly_fee || isNaN(monthly_fee) || Number(monthly_fee) <= 0) {
    return res.status(400).json({ message: 'මාසික ගාස්තුව ධන සංඛ්‍යාවක් විය යුතුය.' });
  }

  try {
    const result = await db.pool.query(
      'UPDATE Courses SET course_name = $1, monthly_fee = $2, teacher_id = $3, subject_id = $4 WHERE course_id = $5 RETURNING *',
      [course_name.trim(), Number(monthly_fee), teacher_id || null, subject_id || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'පාඨමාලාව හමුවුනේ නැත.' });
    }
    await auditService.logAction(req.user?.userId, req.user?.role, 'UPDATE', 'Course', id, `Course "${course_name}" updated.`);
    res.json({ message: 'පාඨමාලාව සාර්ථකව යාවත්කාලීන කළා!', course: result.rows[0] });
  } catch (error) {
    console.error('❌ Update Course Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};