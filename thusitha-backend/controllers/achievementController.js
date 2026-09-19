const db = require('../db');
const auditService = require('../utils/auditService');
const { publicUrl } = require('../middleware/imageUpload');
const { sanitizeText } = require('../utils/validators');

exports.createAchievement = async (req, res) => {
  const { student_id } = req.body;
  let { title, description } = req.body;
  const { island_rank, achieved_year } = req.body;

  if (!student_id || !title) {
    return res.status(400).json({ error: 'ශිෂ්‍යයා සහ ජයග්‍රහණයේ මාතෘකාව අනිවාර්ය වේ.' });
  }
  title = sanitizeText(title, 150);
  description = description ? sanitizeText(description, 1000) : null;

  const image_url = publicUrl(req.file);
  const year = achieved_year ? parseInt(achieved_year, 10) : new Date().getFullYear();
  try {
    const result = await db.pool.query(
      'INSERT INTO Student_Achievements (student_id, title, description, island_rank, achieved_year, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [student_id, title, description, island_rank ? parseInt(island_rank, 10) : null, year, image_url]
    );
    await auditService.logAction(req.user?.userId, req.user?.role, 'CREATE', 'Student_Achievements', result.rows[0].achievement_id, `Created achievement: ${title}`);
    res.status(201).json({ message: 'ජයග්‍රහණය සාර්ථකව ඇතුළත් කළා!', achievement: result.rows[0] });
  } catch (err) {
    console.error('❌ Create Achievement Error:', err.message);
    res.status(500).json({ error: 'ජයග්‍රහණය ඇතුළත් කිරීම අසාර්ථකයි.', details: err.message });
  }
};

exports.getAchievements = async (req, res) => {
  try {
    const result = await db.pool.query(`
      SELECT sa.*, s.student_name 
      FROM Student_Achievements sa
      JOIN Students s ON sa.student_id = s.student_id
      ORDER BY sa.achieved_year DESC, sa.island_rank ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ජයග්‍රහණ ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.getPublicAchievements = async (req, res) => {
  try {
    const result = await db.pool.query(`
      SELECT sa.*, s.student_name 
      FROM Student_Achievements sa
      JOIN Students s ON sa.student_id = s.student_id
      ORDER BY sa.achieved_year DESC, sa.island_rank ASC NULLS LAST
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ජයග්‍රහණ ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.updateAchievement = async (req, res) => {
  const { id } = req.params;
  const { student_id } = req.body;
  let { title, description } = req.body;
  const { island_rank, achieved_year } = req.body;

  if (!student_id || !title) {
    return res.status(400).json({ error: 'ශිෂ්‍යයා සහ ජයග්‍රහණයේ මාතෘකාව අනිවාර්ය වේ.' });
  }
  title = sanitizeText(title, 150);
  description = description ? sanitizeText(description, 1000) : null;

  const image_url = publicUrl(req.file) || req.body.image_url || null;
  const year = achieved_year ? parseInt(achieved_year, 10) : new Date().getFullYear();
  try {
    const result = await db.pool.query(
      'UPDATE Student_Achievements SET student_id = $1, title = $2, description = $3, island_rank = $4, achieved_year = $5, image_url = COALESCE($6, image_url) WHERE achievement_id = $7 RETURNING *',
      [student_id, title, description, island_rank ? parseInt(island_rank, 10) : null, year, image_url, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'ජයග්‍රහණය හමුවුනේ නැත.' });
    await auditService.logAction(req.user?.userId, req.user?.role, 'UPDATE', 'Student_Achievements', id, `Updated achievement: ${title}`);
    res.json({ message: 'ජයග්‍රහණය යාවත්කාලීන කළා!', achievement: result.rows[0] });
  } catch (err) {
    console.error('❌ Update Achievement Error:', err.message);
    res.status(500).json({ error: 'ජයග්‍රහණය යාවත්කාලීන කිරීම අසාර්ථකයි.' });
  }
};

exports.deleteAchievement = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query('DELETE FROM Student_Achievements WHERE achievement_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'ජයග්‍රහණය හමුවුනේ නැත.' });
    await auditService.logAction(req.user?.userId, req.user?.role, 'DELETE', 'Student_Achievements', id, `Deleted achievement: ${result.rows[0].title}`);
    res.json({ message: 'ජයග්‍රහණය මකා දැමුවා!' });
  } catch (err) {
    res.status(500).json({ error: 'ජයග්‍රහණය මකා දැමීම අසාර්ථකයි.' });
  }
};
