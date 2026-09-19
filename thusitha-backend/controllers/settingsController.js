const db = require('../db');
const auditService = require('../utils/auditService');
const { sanitizeText } = require('../utils/validators');

exports.getSettings = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM System_Settings ORDER BY setting_key ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get Settings Error:', err.message);
    res.status(500).json({ error: 'පද්ධති සැකසුම් ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.updateSetting = async (req, res) => {
  const { key } = req.body;
  let { value } = req.body;

  if (!key) {
    return res.status(400).json({ error: 'Setting key අනිවාර්ය වේ.' });
  }
  value = typeof value === 'string' ? sanitizeText(value, 2000) : value;

  try {
    await db.pool.query('UPDATE System_Settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2', [value, key]);
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'System_Setting', null, `Updated setting ${key} to ${value}`);
    res.json({ message: 'සැකසුම සාර්ථකව යාවත්කාලීන කළා!' });
  } catch (err) {
    console.error('❌ Update Setting Error:', err.message);
    res.status(500).json({ error: 'සැකසුම යාවත්කාලීන කිරීම අසාර්ථකයි.' });
  }
};

// Create a new system setting (useful for dynamic SMS templates)
exports.createSetting = async (req, res) => {
  const { key } = req.body;
  let { value, description } = req.body;

  if (!key) {
    return res.status(400).json({ error: 'Setting key අනිවාර්ය වේ.' });
  }
  value = typeof value === 'string' ? sanitizeText(value, 2000) : value;
  description = description ? sanitizeText(description, 300) : '';

  try {
    await db.pool.query(
      'INSERT INTO System_Settings (setting_key, setting_value, description) VALUES ($1, $2, $3)',
      [key, value, description]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'System_Setting', null, `Created setting ${key}`);
    res.status(201).json({ message: 'සැකසුම සාර්ථකව එකතු කළා!' });
  } catch (err) {
    console.error('❌ Create Setting Error:', err.message);
    res.status(500).json({ error: 'සැකසුම එක් කිරීම අසාර්ථකයි.' });
  }
};

// Delete a system setting
exports.deleteSetting = async (req, res) => {
  const { key } = req.params;
  try {
    await db.pool.query('DELETE FROM System_Settings WHERE setting_key = $1', [key]);
    await auditService.logAction(req.user.userId, req.user.role, 'DELETE', 'System_Setting', null, `Deleted setting ${key}`);
    res.json({ message: 'සැකසුම සාර්ථකව ඉවත් කළා!' });
  } catch (err) {
    console.error('❌ Delete Setting Error:', err.message);
    res.status(500).json({ error: 'සැකසුම ඉවත් කිරීම අසාර්ථකයි.' });
  }
};