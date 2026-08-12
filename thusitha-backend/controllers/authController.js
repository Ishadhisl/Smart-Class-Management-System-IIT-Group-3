const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auditService = require('../utils/auditService');
const { sendWhatsAppMessage } = require('../utils/whatsappService');

// පරිශීලක ඇතුළත් වීම (Login)
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.pool.query('SELECT * FROM Users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'පරිශීලකයා හමුවුනේ නැත.' });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'මුරපදය වැරදියි.' });

    const token = jwt.sign(
      { id: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Check if Student still has default password
    let mustChangePassword = false;
    if (user.role === 'Student') {
      const isDefault = await bcrypt.compare('Thusitha@123', user.password_hash);
      if (isDefault) mustChangePassword = true;
    }

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
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await db.pool.query('UPDATE Users SET password_hash = $1 WHERE user_id = $2', [passwordHash, userId]);
    
    await auditService.logAction(userId, req.user.role, 'UPDATE', 'User', userId, 'පරිශීලකයා විසින් මුරපදය වෙනස් කරන ලදී.');
    res.json({ message: 'මුරපදය සාර්ථකව වෙනස් කළා!' });
  } catch (err) {
    console.error('❌ Reset Password Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// පද්ධතියෙන් ඉවත් වීම (Logout)
exports.logout = async (req, res) => {
  // Since JWT is stateless, the frontend should remove the token.
  // We just log the action here.
  try {
    const userId = req.user?.userId;
    if (userId) {
      await auditService.logAction(userId, req.user?.role, 'LOGOUT', 'User', userId, 'පරිශීලකයා පද්ධතියෙන් ඉවත් විය.');
    }
    res.json({ success: true, message: 'සාර්ථකව පද්ධතියෙන් ඉවත් විය.' });
  } catch (err) {
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
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'මුරපදය අකුරු 6කට වද විය යුතුයි.' });
    }
    // OTP validate
    const otpResult = await db.pool.query(
      `SELECT * FROM OTP_Store WHERE username = $1 AND otp_code = $2 AND expires_at > NOW() AND used = FALSE`,
      [username, otp]
    );
    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: 'OTP වාර්දියි හේතෑ කාලය ඔ්රේරි ගියා.' });
    }
    // Password update
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const userRes = await db.pool.query('SELECT user_id, role FROM Users WHERE username = $1', [username]);
    const userId = userRes.rows[0]?.user_id;
    await db.pool.query('UPDATE Users SET password_hash = $1 WHERE username = $2', [passwordHash, username]);
    // Mark OTP as used
    await db.pool.query('UPDATE OTP_Store SET used = TRUE WHERE username = $1 AND otp_code = $2', [username, otp]);
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
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'මුරපදය අකුරු 6කට වඩා විය යුතුයි.' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await db.pool.query('UPDATE Users SET password_hash = $1 WHERE user_id = $2', [passwordHash, userId]);
    
    await auditService.logAction(userId, req.user.role, 'UPDATE', 'User', userId, 'පරිශීලකයා විසින් මුරපදය වෙනස් කරන ලදී.');
    res.json({ message: 'මුරපදය සාර්ථකව වෙනස් කළා!' });
  } catch (err) {
    console.error('❌ Change Password Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
