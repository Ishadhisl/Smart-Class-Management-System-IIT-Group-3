const db = require('../db');

// ඩේටාබේස් එකෙන් සියලුම පන්ති ලබා දීම
exports.getAllCourses = async (req, res) => {
  try {
    const query = 'SELECT * FROM Courses ORDER BY course_name ASC';
    const result = await db.pool.query(query);
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get All Courses Error:', error.message);
    res.status(500).json({ message: "පන්ති දත්ත ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.createCourse = async (req, res) => {
  const { course_name, monthly_fee, teacher_id, subject_id } = req.body;
  try {
    const query = 'INSERT INTO Courses (course_name, monthly_fee, teacher_id, subject_id) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await db.pool.query(query, [course_name, monthly_fee, teacher_id || null, subject_id || null]);
    res.status(201).json({ message: 'පාඨමාලාව සාර්ථකව එකතු කළා!', course: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  const { id } = req.params;
  try {
    await db.pool.query('DELETE FROM Courses WHERE course_id = $1', [id]);
    res.json({ message: 'පාඨමාලාව සාර්ථකව ඉවත් කළා!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  const { id } = req.params;
  const { course_name, monthly_fee, teacher_id, subject_id } = req.body;
  try {
    const result = await db.pool.query(
      'UPDATE Courses SET course_name = $1, monthly_fee = $2, teacher_id = $3, subject_id = $4 WHERE course_id = $5 RETURNING *',
      [course_name, monthly_fee, teacher_id || null, subject_id || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'පාඨමාලාව හමුවුනේ නැත.' });
    }
    res.json({ message: 'පාඨමාලාව සාර්ථකව යාවත්කාලීන කළා!', course: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};