const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const auditService = require('../utils/auditService');
const { sendWhatsAppMessage } = require('../utils/whatsappService');
const { isUsingDefaultPassword } = require('../utils/authDefaults');
const { passwordPolicyError } = require('../utils/validators');

const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 5;

// Parses a JWT_EXPIRY-style duration ("30m", "12h", "1d") into milliseconds, so the
// Sessions row's expires_at stays in sync with the JWT's own expiry. Falls back to 1 day
// for anything unrecognised (e.g. jsonwebtoken's numeric-seconds or "2 days" forms).
function parseExpiryToMs(expiry) {
  const match = /^(\d+)([smhd])$/.exec(String(expiry || '').trim());
  if (!match) return 24 * 60 * 60 * 1000;
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return Number(match[1]) * unitMs[match[2]];
}

// පරිශීලක ඇතුළත් වීම (Login)
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'පරිශීලක නාමය සහ මුරපදය අනිවාර්ය වේ.' });
  }
  try {
    const result = await db.pool.query('SELECT * FROM Users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'පරිශීලකයා හමුවුනේ නැත.' });

    const user = result.rows[0];

    // Locked account - reject even a CORRECT password until the lock window passes.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMin = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        message: `වැරදි මුරපද ${MAX_LOGIN_ATTEMPTS} වතාවක් ඇතුළත් කිරීම නිසා ගිණුම තාවකාලිකව අගුලු දමා ඇත. විනාඩි ${remainingMin}කින් නැවත උත්සාහ කරන්න.`,
        locked_until: user.locked_until
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const attempts = (user.failed_login_attempts || 0) + 1;

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await db.pool.query(
          'UPDATE Users SET failed_login_attempts = 0, locked_until = $1 WHERE user_id = $2',
          [lockedUntil, user.user_id]
        );
        await auditService.logAction(user.user_id, user.role, 'LOGIN_LOCKED', 'User', user.user_id, `Account locked for ${LOCKOUT_MINUTES} min after ${MAX_LOGIN_ATTEMPTS} failed login attempts.`);
        return res.status(423).json({
          message: `වැරදි මුරපද ${MAX_LOGIN_ATTEMPTS} වතාවක් ඇතුළත් කිරීම නිසා ගිණුම විනාඩි ${LOCKOUT_MINUTES}ක් අගුලු දමා ඇත.`,
          locked_until: lockedUntil
        });
      }

      await db.pool.query('UPDATE Users SET failed_login_attempts = $1 WHERE user_id = $2', [attempts, user.user_id]);
      return res.status(401).json({ message: `මුරපදය වැරදියි. (උත්සාහයන් ${attempts}/${MAX_LOGIN_ATTEMPTS})` });
    }

    // Successful login - clear any accumulated failed-attempt/lockout state.
    if (user.failed_login_attempts || user.locked_until) {
      await db.pool.query('UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = $1', [user.user_id]);
    }

    const jwtExpiry = process.env.JWT_EXPIRY || '1d';
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { id: user.user_id, username: user.username, role: user.role, jti },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiry }
    );

    // Track this login as a revocable server-side session (real logout, password-change
    // invalidation, admin force-logout, "my active devices" list).
    const sessionExpiresAt = new Date(Date.now() + parseExpiryToMs(jwtExpiry));
    await db.pool.query(
      `INSERT INTO Sessions (user_id, jti, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.user_id, jti, (req.headers?.['user-agent'] || '').slice(0, 255), req.ip || null, sessionExpiresAt]
    );

    // Nudge any user still on their role's default password to personalise it.
    const mustChangePassword = await isUsingDefaultPassword(user.role, user.password_hash)
      || await bcrypt.compare('Thusitha@123', user.password_hash); // legacy default

    // 📋 Industrial Standard: Log the successful login
    await auditService.logAction(user.user_id, user.role, 'LOGIN', 'User', user.user_id, `User ${username} logged into the system.`);

    res.json({
      success: true,
      token: token,
      message: 'සාර්ථකව ඇතුළු විය!',
      must_change_password: mustChangePassword,
      user: { id: user.user_id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('❌ Login Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ලියාපදිංචිය සඳහා Placeholder
exports.register = async (req, res) => {
  res.status(501).json({ message: "පරිශීලක ලියාපදිංචිය අදාළ අංශය මගින් සිදු කළ යුතුය." });
};

// මුරපදය වෙනස් කිරීම (Reset Password)
exports.resetPassword = async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.user.userId;
  try {
    const policyError = passwordPolicyError(newPassword, { role: req.user.role });
    if (policyError) return res.status(400).json({ message: policyError });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await db.pool.query('UPDATE Users SET password_hash = $1 WHERE user_id = $2', [passwordHash, userId]);

    // A password change likely means the old password may have leaked - kill every OTHER
    // active session for this account (the one making this request stays alive so the
    // user isn't logged out of the tab they just used to change it).
    await db.pool.query(
      `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'password_changed'
       WHERE user_id = $1 AND revoked_at IS NULL AND jti != $2`,
      [userId, req.user.jti]
    );

    await auditService.logAction(userId, req.user.role, 'UPDATE', 'User', userId, 'පරිශීලකයා විසින් මුරපදය වෙනස් කරන ලදී.');
    res.json({ message: 'මුරපදය සාර්ථකව වෙනස් කළා!' });
  } catch (err) {
    console.error('❌ Reset Password Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// පද්ධතියෙන් ඉවත් වීම (Logout)
exports.logout = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const jti = req.user?.jti;
    if (jti) {
      await db.pool.query(
        `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'logout'
         WHERE jti = $1 AND revoked_at IS NULL`,
        [jti]
      );
    }
    if (userId) {
      await auditService.logAction(userId, req.user?.role, 'LOGOUT', 'User', userId, 'පරිශීලකයා පද්ධතියෙන් ඉවත් විය.');
    }
    res.json({ success: true, message: 'සාර්ථකව පද්ධතියෙන් ඉවත් විය.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// පරිශීලකයාගේ සක්‍රීය සැසි ලැයිස්තුව (My active sessions / devices)
exports.getMySessions = async (req, res) => {
  try {
    const result = await db.pool.query(
      `SELECT session_id, jti, device_info, ip_address, created_at, last_active_at, expires_at
       FROM Sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [req.user.userId]
    );
    const sessions = result.rows.map(({ jti, ...s }) => ({ ...s, is_current: jti === req.user.jti }));
    res.json(sessions);
  } catch (err) {
    console.error('❌ Get My Sessions Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// තමන්ගේම උපාංගයක සැසියක් අවසන් කිරීම (Revoke one of my own sessions)
exports.revokeSession = async (req, res) => {
  try {
    const result = await db.pool.query(
      `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'user_revoked'
       WHERE session_id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING session_id`,
      [req.params.sessionId, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'සැසිය හමු නොවුණි.' });
    }
    res.json({ success: true, message: 'උපාංගයෙන් සාර්ථකව ඉවත් කළා.' });
  } catch (err) {
    console.error('❌ Revoke Session Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// සියලුම වෙනත් උපාංග වලින් ඉවත් වීම (Logout from all OTHER devices, current one stays live)
exports.logoutAllDevices = async (req, res) => {
  try {
    await db.pool.query(
      `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'logout_all'
       WHERE user_id = $1 AND revoked_at IS NULL AND jti != $2`,
      [req.user.userId, req.user.jti]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'LOGOUT_ALL_DEVICES', 'User', req.user.userId, 'සියලුම වෙනත් උපාංග වලින් ඉවත් විය.');
    res.json({ success: true, message: 'වෙනත් සියලුම උපාංග වලින් සාර්ථකව ඉවත් කළා.' });
  } catch (err) {
    console.error('❌ Logout All Devices Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// මුරපදය අමතක වීම (Forgot Password) — WhatsApp OTP
exports.forgotPassword = async (req, res) => {
  const { username } = req.body;
  try {
    // 1. username ස෭ියැන්දා
    const result = await db.pool.query(
      `SELECT u.user_id, u.username, u.role, p.parent_phone
       FROM Users u
       LEFT JOIN Students s ON s.user_id = u.user_id
       LEFT JOIN Parents p ON s.parent_id = p.parent_id
       WHERE u.username = $1`,
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'පරිශීලකයා හමුවුනේ නැත.' });
    }
    const user = result.rows[0];
    
    let phone = null;
    if (user.role === 'Student') {
      phone = user.parent_phone;
    } else if (user.role === 'Parent') {
      const parentRes = await db.pool.query(
        'SELECT parent_phone FROM Parents WHERE user_id = $1', [user.user_id]
      ).catch(() => ({ rows: [] }));
      phone = parentRes.rows[0]?.parent_phone || null;
    } else if (user.role === 'Teacher') {
      const teacherRes = await db.pool.query(
        'SELECT phone FROM Teachers WHERE user_id = $1', [user.user_id]
      ).catch(() => ({ rows: [] }));
      phone = teacherRes.rows[0]?.phone || null;
    } else if (user.role === 'Counter Person') {
      const counterRes = await db.pool.query(
        'SELECT phone FROM Counter_Person WHERE user_id = $1', [user.user_id]
      ).catch(() => ({ rows: [] }));
      phone = counterRes.rows[0]?.phone || null;
    } else if (user.role === 'Admin') {
      const teacherRes = await db.pool.query(
        'SELECT phone FROM Teachers WHERE user_id = $1', [user.user_id]
      ).catch(() => ({ rows: [] }));
      phone = teacherRes.rows[0]?.phone || null;
      if (!phone) {
        const counterRes = await db.pool.query(
          'SELECT phone FROM Counter_Person WHERE user_id = $1', [user.user_id]
        ).catch(() => ({ rows: [] }));
        phone = counterRes.rows[0]?.phone || null;
      }
    }

    if (!phone) {
      return res.status(400).json({ message: 'අදාල් පරිශීලකයාට WhatsApp දුරකඣ අංකයක් පද්ධතියේ නැත. Admin හට හ්සම්බන්ද වන්න.' });
    }

    // 2. OTP generate
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 3. OTP DB එක save
    await db.pool.query(
      'DELETE FROM OTP_Store WHERE username = $1', [username] // old OTPs delete
    );
    await db.pool.query(
      'INSERT INTO OTP_Store (username, otp_code, expires_at) VALUES ($1, $2, $3)',
      [username, otpCode, expiresAt]
    );

    // 4. WhatsApp OTP send
    const message = 
      `🔐 *Thusitha Institute — මුරපද ය෭ළ සැකසීම*\n\n` +
      `📱 ඔබගේ OTP කේතුව: *${otpCode}*\n` +
      `⏰ පමණ මිනිත්තු 10ක් එතුලත ජේවය වැලි කරන්න.\n\n` +
      `⚠️ මෙම OTP එදික්කම කෙනේකට දෙන් එපා.\n\n` +
      `_Thusitha Institute — Smart Class System_`;

    const waResult = await sendWhatsAppMessage(phone, message);
    if (!waResult.success) {
      if (waResult.mock) {
        return res.status(503).json({ message: 'WhatsApp සේවාව දැනට ක්‍රියා විරහිතයි (Not Connected). කරුණාකර Admin අමතන්න.' });
      }
      return res.status(500).json({ message: 'WhatsApp OTP යැවීමට නොහැකි විය: ' + waResult.error });
    }

    await auditService.logAction(user.user_id, user.role, 'FORGOT_PASSWORD', 'User', user.user_id, `OTP sent to WhatsApp for ${username}`);
    res.json({ 
      success: true, 
      message: `WhatsApp OTP යවන ලදී! ඔබගේ දුරකඣය අංකය ඐහී ලේබීම් කරන්න.`,
      phone_hint: phone.length > 6 ? phone.replace(/^(\d{3}).*(\d{3})$/, '$1***$2') : '***' // partial phone hint
    });
  } catch (err) {
    console.error('❌ Forgot Password Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// OTP තහවුරු කිරීම (Verify OTP)
exports.verifyOtp = async (req, res) => {
  const { username, otp } = req.body;
  try {
    const result = await db.pool.query(
      `SELECT * FROM OTP_Store WHERE username = $1 AND otp_code = $2 AND expires_at > NOW() AND used = FALSE`,
      [username, otp]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'OTP වාර්දියි හේතෑ කාලය ඔ්රේරි ගියා.' });
    }
    res.json({ success: true, message: 'OTP හොදියි. අලුත් මුරපදය එතුලත් කරන්න.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// OTP නයටින් මුරපදය වේනස් කිරීම (Reset Password with OTP)
exports.resetWithOtp = async (req, res) => {
  const { username, otp, newPassword } = req.body;
  try {
    // OTP validate
    const otpResult = await db.pool.query(
      `SELECT * FROM OTP_Store WHERE username = $1 AND otp_code = $2 AND expires_at > NOW() AND used = FALSE`,
      [username, otp]
    );
    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: 'OTP වැරදියි හෝ කාලය ඉකුත් වී ඇත.' });
    }
    // Password update (same strength policy as the first-login change form)
    const userRes = await db.pool.query('SELECT user_id, role FROM Users WHERE username = $1', [username]);
    const userId = userRes.rows[0]?.user_id;
    const policyError = passwordPolicyError(newPassword, { role: userRes.rows[0]?.role });
    if (policyError) return res.status(400).json({ message: policyError });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await db.pool.query('UPDATE Users SET password_hash = $1 WHERE username = $2', [passwordHash, username]);
    // Mark OTP as used
    await db.pool.query('UPDATE OTP_Store SET used = TRUE WHERE username = $1 AND otp_code = $2', [username, otp]);
    // No "current session" to protect here (this flow runs before login) - kill every
    // existing session for the account, since a forgot-password reset implies the old
    // password (and anything logged in with it) may no longer be trusted.
    await db.pool.query(
      `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'password_reset_otp'
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    await auditService.logAction(userId, userRes.rows[0]?.role, 'RESET_PASSWORD_OTP', 'User', userId, `Password reset via OTP for ${username}`);
    res.json({ success: true, message: 'මුරපදය සාර්ඥකව වේනස් කලා! ලොගින් වීමට යෝමු වේ.' });
  } catch (err) {
    console.error('❌ Reset With OTP Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Student පළමු වර පිළිගැනීමේදී මුරපදය වෙනස් කිරීම (Change Password)
exports.changePassword = async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.user.userId;
  try {
    const policyError = passwordPolicyError(newPassword, { role: req.user.role });
    if (policyError) return res.status(400).json({ message: policyError });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await db.pool.query('UPDATE Users SET password_hash = $1 WHERE user_id = $2', [passwordHash, userId]);

    await db.pool.query(
      `UPDATE Sessions SET revoked_at = NOW(), revoked_reason = 'password_changed'
       WHERE user_id = $1 AND revoked_at IS NULL AND jti != $2`,
      [userId, req.user.jti]
    );

    await auditService.logAction(userId, req.user.role, 'UPDATE', 'User', userId, 'පරිශීලකයා විසින් මුරපදය වෙනස් කරන ලදී.');
    res.json({ message: 'මුරපදය සාර්ථකව වෙනස් කළා!' });
  } catch (err) {
    console.error('❌ Change Password Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
