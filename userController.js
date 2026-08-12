const db = require('../db');
const auditService = require('../utils/auditService');
const bcrypt = require('bcryptjs');

// පද්ධති පරිශීලකයින් සියලුම දෙනා ලබා ගැනීම (Teachers/Staff)
exports.getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT user_id, username, role, created_at 
      FROM Users 
      WHERE role != 'Student'
      ORDER BY created_at DESC
    `;
    const result = await db.pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get All Users Error:', error.message);
    res.status(500).json({ message: "පරිශීලකයින් ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { id } = req.params;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Thusitha@123', salt);
    
    const result = await db.pool.query(
      'UPDATE Users SET password_hash = $1 WHERE user_id = $2 RETURNING user_id',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Password reset to default (Thusitha@123) successfully!' });
  } catch (error) {
    console.error('?O Reset Password Error:', error.message);
    res.status(500).json({ message: "Failed to reset password.", error: error.message });
  }
};

exports.createUser = async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: "පරිශීලක නාමය, මුරපදය සහ තනතුර (Role) අවශ්‍ය වේ." });
  }

  if (!['Admin', 'Counter Person'].includes(role)) {
    return res.status(400).json({ message: "වලංගු නොවන තනතුරකි. (Invalid role)" });
  }

  try {
    const checkUser = await db.pool.query('SELECT 1 FROM Users WHERE username = $1', [username]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "මෙම පරිශීලක නාමය (Username) දැනටමත් භාවිතයේ පවතී." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.pool.query(
      'INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id, username, role, created_at',
      [username, passwordHash, role]
    );

    await auditService.logAction(req.user?.userId, req.user?.role, 'CREATE', 'User', result.rows[0].user_id, `Created new staff user: ${username} (Role: ${role})`);
    
    res.status(201).json({ message: 'නව පරිශීලකයා සාර්ථකව ඇතුළත් කළා!', user: result.rows[0] });
  } catch (error) {
    console.error('❌ Create User Error:', error.message);
    res.status(500).json({ message: "පරිශීලකයා ඇතුළත් කිරීමට නොහැකි විය.", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  
  if (Number(id) === req.user?.userId) {
    return res.status(400).json({ message: "ඔබගේම ගිණුම මකා දැමිය නොහැක." });
  }

  try {
    const userRes = await db.pool.query('SELECT username, role FROM Users WHERE user_id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "පරිශීලකයා හමුවුනේ නැත." });
    }

    const user = userRes.rows[0];

    if (user.username === 'admin') {
      return res.status(400).json({ message: "ප්‍රධාන admin ගිණුම මකා දැමිය නොහැක." });
    }

    await db.pool.query('DELETE FROM Users WHERE user_id = $1', [id]);

    await auditService.logAction(req.user?.userId, req.user?.role, 'DELETE', 'User', id, `Deleted staff user: ${user.username} (Role: ${user.role})`);
    res.status(200).json({ message: 'පරිශීලකයා සාර්ථකව ඉවත් කළා!' });
  } catch (error) {
    console.error('❌ Delete User Error:', error.message);
    res.status(500).json({ message: "පරිශීලකයා ඉවත් කිරීමට නොහැකි විය.", error: error.message });
  }
};