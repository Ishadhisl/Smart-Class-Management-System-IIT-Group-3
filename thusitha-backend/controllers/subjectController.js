const db = require('../db');
const { sanitizeText } = require('../utils/validators');

exports.getAllSubjects = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM Subjects ORDER BY subject_name ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "විෂයන් ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.createSubject = async (req, res) => {
  let { subject_name, description } = req.body;
  if (!subject_name) {
    return res.status(400).json({ message: "විෂය නාමය අවශ්‍ය වේ." });
  }
  subject_name = sanitizeText(subject_name, 100);
  description = description ? sanitizeText(description, 500) : null;

  try {
    const result = await db.pool.query(
      'INSERT INTO Subjects (subject_name, description) VALUES ($1, $2) RETURNING *',
      [subject_name, description]
    );
    res.status(201).json({
      message: 'Subject created successfully',
      subject: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: "විෂය ඇතුළත් කිරීම අසාර්ථකයි.", error: error.message });
  }
};

exports.deleteSubject = async (req, res) => {
  const { id } = req.params;
  try {
    await db.pool.query('DELETE FROM Subjects WHERE subject_id = $1', [id]);
    res.json({ message: 'විෂය සාර්ථකව ඉවත් කළා!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSubject = async (req, res) => {
  const { id } = req.params;
  let { subject_name, description } = req.body;
  if (!subject_name) {
    return res.status(400).json({ message: "විෂය නාමය අවශ්‍ය වේ." });
  }
  subject_name = sanitizeText(subject_name, 100);
  description = description ? sanitizeText(description, 500) : null;

  try {
    const result = await db.pool.query(
      'UPDATE Subjects SET subject_name = $1, description = $2 WHERE subject_id = $3 RETURNING *',
      [subject_name, description, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "විෂය හමුවුනේ නැත." });
    }
    res.json({ message: 'විෂය සාර්ථකව යාවත්කාලීන කළා!', subject: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "විෂය යාවත්කාලීන කිරීම අසාර්ථකයි.", error: error.message });
  }
};