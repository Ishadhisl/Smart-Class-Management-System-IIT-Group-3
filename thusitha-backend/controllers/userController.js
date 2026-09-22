const db = require('../db');
const auditService = require('../utils/auditService');
const bcrypt = require('bcryptjs');
const { defaultPasswordFor } = require('../utils/authDefaults');
const { sanitizeText, passwordPolicyError } = require('../utils/validators');

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
    const target = await db.pool.query('SELECT role FROM Users WHERE user_id = $1', [id]);
    if (target.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const role = target.rows[0].role;
    const defaultPw = defaultPasswordFor(role);
    const hashedPassword = await bcrypt.hash(defaultPw, 10);

    await db.pool.query(
      'UPDATE Users SET password_hash = $1 WHERE user_id = $2',
      [hashedPassword, id]
    );

    // Admin-forced password reset - kill every active session for that account so the old
    // password's tokens stop working immediately instead of drifting for up to a day.
    await db.pool.query(
      `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'password_reset_by_admin'
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [id]
    );

    await auditService.logAction(req.user?.userId, req.user?.role, 'RESET_PASSWORD', 'User', id, `Reset password to role default for user ${id}`);
    res.status(200).json({ message: `Password reset to default (${defaultPw}) successfully!` });
  } catch (error) {
    console.error('?O Reset Password Error:', error.message);
    res.status(500).json({ message: "Failed to reset password.", error: error.message });
  }
};

exports.createUser = async (req, res) => {
  const { password, role } = req.body;
  let { username } = req.body;
  if (!username || !role) {
    return res.status(400).json({ message: "පරිශීලක නාමය සහ තනතුර (Role) අවශ්‍ය වේ." });
  }

  if (!['Admin', 'Counter Person'].includes(role)) {
    return res.status(400).json({ message: "වලංගු නොවන තනතුරකි. (Invalid role)" });
  }
  username = sanitizeText(username, 100);

  try {
    const checkUser = await db.pool.query('SELECT 1 FROM Users WHERE username = $1', [username]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "මෙම පරිශීලක නාමය (Username) දැනටමත් භාවිතයේ පවතී." });
    }

    // Password is optional — a blank one falls back to the role's default (Admin@123 /
    // Counter@123), which login then flags for change. A supplied one must meet the policy.
    if (password) {
      const policyError = passwordPolicyError(password, { role });
      if (policyError) return res.status(400).json({ message: policyError });
    }
    const passwordHash = await bcrypt.hash(password || defaultPasswordFor(role), 10);

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

// සියලුම පරිශීලකයන්ගේ සක්‍රීය සැසි (Admin: every active login session across all users)
exports.getAllActiveSessions = async (req, res) => {
  try {
    const result = await db.pool.query(
      `SELECT s.session_id, s.user_id, u.username, u.role, s.device_info, s.ip_address,
              s.created_at, s.last_active_at, s.expires_at
       FROM Sessions s
       JOIN Users u ON u.user_id = s.user_id
       WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
       ORDER BY s.last_active_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get Active Sessions Error:', error.message);
    res.status(500).json({ message: "සක්‍රීය සැසි ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

// Admin: වෙනත් පරිශීලකයෙකුගේ සැසියක් බලෙන් අවසන් කිරීම (force-logout a device)
exports.revokeUserSession = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await db.pool.query(
      `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'admin_revoked'
       WHERE session_id = $1 AND revoked_at IS NULL
       RETURNING user_id`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'සැසිය හමු නොවුණි.' });
    }
    await auditService.logAction(req.user?.userId, req.user?.role, 'ADMIN_REVOKE_SESSION', 'User', result.rows[0].user_id, `Admin force-logged-out session ${sessionId}`);
    res.status(200).json({ message: 'සැසිය සාර්ථකව අවසන් කළා.' });
  } catch (error) {
    console.error('❌ Revoke User Session Error:', error.message);
    res.status(500).json({ message: "සැසිය අවසන් කිරීමට නොහැකි විය.", error: error.message });
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