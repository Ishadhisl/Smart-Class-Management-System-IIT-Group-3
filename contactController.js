const db = require('../db');
const auditService = require('../utils/auditService');

// 🛡️ Keywords that trigger automatic spam filtering
const SUSPICIOUS_KEYWORDS = ['crypto', 'bitcoin', 'investment', 'casino', 'marketing agency', 'free gift', 'win money', 'viagra'];

exports.submitInquiry = async (req, res) => {
  const { sender_name, sender_email, sender_phone, subject, message_text } = req.body;

  if (!sender_name || !sender_email || !message_text) {
    return res.status(400).json({ message: "නම, විද්‍යුත් තැපෑල සහ පණිවිඩය අනිවාර්ය වේ." });
  }

  // 🔍 Auto-Spam Detection Logic
  const contentToSearch = `${subject || ''} ${message_text}`.toLowerCase();
  const isSpam = SUSPICIOUS_KEYWORDS.some(keyword => contentToSearch.includes(keyword));
  const status = isSpam ? 'Spam' : 'Pending';

  try {
    const query = `
      INSERT INTO Contact_Messages (sender_name, sender_email, sender_phone, subject, message_text, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.pool.query(query, [sender_name, sender_email, sender_phone, subject, message_text, status]);
    
    await auditService.logAction(null, 'Public', 'CREATE', 'Contact_Message', result.rows[0].message_id, 
      `New inquiry from ${sender_name}. ${isSpam ? '[AUTO-SPAM TRIGGERED]' : ''}`);

    res.status(201).json({ message: 'පණිවිඩය සාර්ථකව යොමු කරන ලදී.', data: result.rows[0] });
  } catch (error) {
    console.error('❌ Contact Submission Error:', error.message);
    res.status(500).json({ error: 'පණිවිඩය යැවීමට නොහැකි විය.' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const result = await db.pool.query('SELECT * FROM Contact_Messages ORDER BY submitted_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  const { messageId } = req.params;
  try {
    await db.pool.query('UPDATE Contact_Messages SET is_read = TRUE WHERE message_id = $1', [messageId]);
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Contact_Message', Number.parseInt(messageId, 10), `Marked contact message ${messageId} as read.`);
    res.status(200).json({ message: 'පණිවිඩය කියවා ඇති බවට ලකුණු කරන ලදී.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🧹 Marks all non-spam messages as read.
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await db.pool.query("UPDATE Contact_Messages SET is_read = TRUE WHERE status != 'Spam' AND is_read = FALSE");
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Contact_Message', null, 'Bulk marked all inquiries as read.');
    res.status(200).json({ message: 'සියලුම පණිවිඩ කියවූ බව සටහන් කළා!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ⭐ Toggles the "Important" flag for an inquiry.
 */
exports.toggleImportant = async (req, res) => {
  const { messageId } = req.params;
  try {
    const current = await db.pool.query('SELECT is_important FROM Contact_Messages WHERE message_id = $1', [messageId]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'පණිවිඩය හමුවුනේ නැත.' });
    
    const newVal = !current.rows[0].is_important;
    await db.pool.query('UPDATE Contact_Messages SET is_important = $1 WHERE message_id = $2', [newVal, messageId]);
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Contact_Message', Number.parseInt(messageId, 10), `Toggled importance for message ${messageId} to ${newVal}.`);
    res.status(200).json({ message: newVal ? 'වැදගත් ලෙස සටහන් කළා!' : 'සාමාන්‍ය පණිවිඩයක් ලෙස සටහන් කළා.', is_important: newVal });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🚫 Marks an inquiry as Spam.
 */
exports.markAsSpam = async (req, res) => {
  const { messageId } = req.params;
  try {
    await db.pool.query("UPDATE Contact_Messages SET status = 'Spam', is_read = TRUE WHERE message_id = $1", [messageId]);
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Contact_Message', Number.parseInt(messageId, 10), `Marked message ${messageId} as spam.`);
    res.status(200).json({ message: 'පණිවිඩය Spam ලෙස සටහන් කළා!' });
  } catch (error) {
    console.error('❌ Mark Spam Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🔄 Recovers an inquiry from Spam.
 */
exports.recoverFromSpam = async (req, res) => {
  const { messageId } = req.params;
  try {
    await db.pool.query("UPDATE Contact_Messages SET status = 'Pending' WHERE message_id = $1", [messageId]);
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Contact_Message', Number.parseInt(messageId, 10), `Recovered message ${messageId} from spam.`);
    res.status(200).json({ message: 'පණිවිඩය Spam වලින් සාර්ථකව ඉවත් කළා.' });
  } catch (error) {
    console.error('❌ Recover Spam Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};