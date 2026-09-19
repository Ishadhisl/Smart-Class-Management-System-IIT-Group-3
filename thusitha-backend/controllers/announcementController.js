const db = require('../db');
const auditService = require('../utils/auditService');
const { sanitizeText } = require('../utils/validators');

exports.createAnnouncement = async (req, res) => {
  let { title, body } = req.body;
  const { is_active } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'මාතෘකාව සහ විස්තරය අනිවාර්ය වේ.' });
  }
  title = sanitizeText(title, 150);
  body = sanitizeText(body, 2000);

  try {
    const result = await db.pool.query(
      'INSERT INTO Announcements (title, body, is_active, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, body, is_active !== undefined ? is_active : true, req.user?.userId]
    );
    await auditService.logAction(req.user?.userId, req.user?.role, 'CREATE', 'Announcements', result.rows[0].announcement_id, `Created announcement: ${title}`);
    res.status(201).json({ message: 'නිවේදනය සාර්ථකව පළ කළා!', announcement: result.rows[0] });
  } catch (err) {
    console.error('❌ Create Announcement Error:', err.message);
    res.status(500).json({ error: 'නිවේදනය පළ කිරීම අසාර්ථකයි.' });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM Announcements ORDER BY posted_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'නිවේදන ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.getPublicAnnouncements = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM Announcements WHERE is_active = TRUE ORDER BY posted_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'නිවේදන ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.updateAnnouncement = async (req, res) => {
  const { id } = req.params;
  let { title, body } = req.body;
  const { is_active } = req.body;

  if (!title || !body) {
    return res.status(400).json({ message: 'මාතෘකාව සහ විස්තරය අනිවාර්ය වේ.' });
  }
  title = sanitizeText(title, 150);
  body = sanitizeText(body, 2000);

  try {
    const result = await db.pool.query(
      'UPDATE Announcements SET title = $1, body = $2, is_active = $3 WHERE announcement_id = $4 RETURNING *',
      [title, body, is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'නිවේදනය හමුවුනේ නැත.' });
    await auditService.logAction(req.user?.userId, req.user?.role, 'UPDATE', 'Announcements', id, `Updated announcement: ${title}`);
    res.json({ message: 'නිවේදනය සාර්ථකව යාවත්කාලීන කළා!', announcement: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'නිවේදනය යාවත්කාලීන කිරීම අසාර්ථකයි.' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query('DELETE FROM Announcements WHERE announcement_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'නිවේදනය හමුවුනේ නැත.' });
    await auditService.logAction(req.user?.userId, req.user?.role, 'DELETE', 'Announcements', id, `Deleted announcement: ${result.rows[0].title}`);
    res.json({ message: 'නිවේදනය සාර්ථකව මකා දැමුවා!' });
  } catch (err) {
    res.status(500).json({ error: 'නිවේදනය මකා දැමීම අසාර්ථකයි.' });
  }
};
