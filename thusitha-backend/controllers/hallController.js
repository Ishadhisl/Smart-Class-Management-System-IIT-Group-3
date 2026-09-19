const db = require('../db');
const auditService = require('../utils/auditService');
const { sanitizeText } = require('../utils/validators');

// Get all halls
exports.getAllHalls = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT hall_id, hall_name, capacity FROM Halls ORDER BY hall_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get All Halls Error:', err.message);
    res.status(500).json({ error: 'ශාලා දත්ත ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.createHall = async (req, res) => {
  let { hall_name } = req.body;
  const { capacity } = req.body;

  if (!hall_name || !capacity) {
    return res.status(400).json({ error: 'ශාලාවේ නම සහ ධාරිතාව අනිවාර්ය වේ.' });
  }
  hall_name = sanitizeText(hall_name, 100);

  try {
    const result = await db.pool.query(
      'INSERT INTO Halls (hall_name, capacity) VALUES ($1, $2) RETURNING *',
      [hall_name, capacity]
    );
    res.status(201).json({ message: 'ශාලාව සාර්ථකව එකතු කළා!', hall: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteHall = async (req, res) => {
  const { id } = req.params;
  try {
    await db.pool.query('DELETE FROM Halls WHERE hall_id = $1', [id]);
    res.json({ message: 'ශාලාව සාර්ථකව ඉවත් කළා!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateHall = async (req, res) => {
  const { id } = req.params;
  let { hall_name } = req.body;
  const { capacity } = req.body;

  if (!hall_name || !capacity) {
    return res.status(400).json({ message: 'ශාලාවේ නම සහ ධාරිතාව අනිවාර්ය වේ.' });
  }
  hall_name = sanitizeText(hall_name, 100);

  try {
    const result = await db.pool.query(
      'UPDATE Halls SET hall_name = $1, capacity = $2 WHERE hall_id = $3 RETURNING *',
      [hall_name, capacity, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ශාලාව හමුවුනේ නැත.' });
    }
    res.json({ message: 'ශාලාව සාර්ථකව යාවත්කාලීන කළා!', hall: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};