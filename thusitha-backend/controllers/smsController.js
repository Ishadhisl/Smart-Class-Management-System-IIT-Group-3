const db = require('../db');
const auditService = require('../utils/auditService');
const smsService = require('../utils/smsService');
const { sendWhatsAppMessage, getQrCode, getStatus, logoutWhatsApp, reconnectWhatsApp } = require('../utils/whatsappService');

// ═══════════════════════════════════════════════════════════
// 📊 WhatsApp Connection Status
// ═══════════════════════════════════════════════════════════
exports.getWhatsAppStatus = (req, res) => {
  const status = getStatus();
  res.status(200).json(status);
};

exports.getWhatsAppQr = (req, res) => {
  const qr = getQrCode();
  if (!qr) {
    const status = getStatus();
    return res.status(200).json({ 
      hasQr: false, 
      isReady: status.isReady,
      message: status.isReady ? 'WhatsApp 连接成功! Ready to send messages.' : 'No QR code available. Restart the server.' 
    });
  }
  res.status(200).json({ hasQr: true, qr });
};

exports.logoutWhatsApp = async (req, res) => {
  const result = await logoutWhatsApp();
  res.status(200).json(result);
};

exports.reconnectWhatsApp = async (req, res) => {
  try {
    const result = await reconnectWhatsApp();
    res.status(200).json(result);
  } catch (err) {
    console.error('❌ WhatsApp reconnect error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 📋 SMS/WhatsApp Log ලබා ගැනීම
// ═══════════════════════════════════════════════════════════
exports.getSmsLogs = async (req, res) => {
  try {
    const result = await db.pool.query(
      `SELECT sl.*, p.parent_name as pname
       FROM WhatsApp_Logs sl
       LEFT JOIN Parents p ON sl.parent_id = p.parent_id
       ORDER BY sl.sent_at DESC`
    );
    
    // parent_name: use from log itself (already saved) or join
    const rows = result.rows.map(row => ({
      ...row,
      parent_name: row.parent_name || row.pname || 'N/A'
    }));
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('❌ Get SMS Logs Error:', error.message);
    res.status(500).json({ message: 'WhatsApp වාර්තා ලබා ගැනීමට නොහැකි විය.', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 🔄 Message නැවත යැවීම
// ═══════════════════════════════════════════════════════════
exports.resendSms = async (req, res) => {
  const { logId } = req.params;
  try {
    const logResult = await db.pool.query('SELECT * FROM WhatsApp_Logs WHERE log_id = $1', [logId]);
    if (logResult.rows.length === 0) {
      return res.status(404).json({ message: 'WhatsApp වාර්තාව හමුවුනේ නැත.' });
    }

    const log = logResult.rows[0];
    const sendResult = await sendWhatsAppMessage(log.parent_phone, log.message_body);

    if (sendResult.success) {
      await db.pool.query(
        `UPDATE WhatsApp_Logs SET status = 'Sent', whatsapp_status = 'Sent' WHERE log_id = $1`,
        [logId]
      );
      await auditService.logAction(req.user.userId, req.user.role, 'RESEND_WA', 'WhatsApp_Logs', logId, `WhatsApp resent to ${log.parent_phone}`);
      return res.status(200).json({ success: true, message: 'WhatsApp message නැවත යවන ලදී.' });
    }

    return res.status(400).json({ success: false, message: 'WhatsApp message යැවීමට අසමත් විය.', error: sendResult.error });
  } catch (error) {
    console.error('❌ Resend WhatsApp Error:', error.message);
    res.status(500).json({ success: false, message: 'WhatsApp නැවත යැවීමේදී දෝෂයක් ඇති විය.', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 🗑️ Log Delete
// ═══════════════════════════════════════════════════════════
exports.deleteSmsLog = async (req, res) => {
  const { logId } = req.params;
  try {
    await db.pool.query('DELETE FROM WhatsApp_Logs WHERE log_id = $1', [logId]);
    await auditService.logAction(req.user.userId, req.user.role, 'DELETE', 'WhatsApp_Logs', logId, `Deleted WhatsApp log ID: ${logId}`);
    res.status(200).json({ message: 'WhatsApp වාර්තාව ඉවත් කළා.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 📦 Bulk Resend (Date-wise)
// ═══════════════════════════════════════════════════════════
exports.bulkResendSms = async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ message: 'කරුණාකර දිනයක් ලබා දෙන්න.' });

  try {
    const failedLogs = await db.pool.query(
      `SELECT * FROM WhatsApp_Logs WHERE (status = 'Failed' OR whatsapp_status = 'Failed') AND DATE(sent_at) = $1`,
      [date]
    );

    let successCount = 0;
    for (const log of failedLogs.rows) {
      const result = await sendWhatsAppMessage(log.parent_phone, log.message_body);
      if (result.success) {
        await db.pool.query(
          `UPDATE WhatsApp_Logs SET status = 'Sent', whatsapp_status = 'Sent' WHERE log_id = $1`,
          [log.log_id]
        );
        successCount++;
      }
    }

    await auditService.logAction(req.user.userId, req.user.role, 'BULK_RESEND_WA', 'WhatsApp_Logs', null, `Bulk resend for ${date}. ${successCount} sent.`);
    res.status(200).json({ message: `සාර්ථකයි! ${successCount} WhatsApp messages නැවත යවන ලදී.`, resent_count: successCount });
  } catch (error) {
    console.error('❌ Bulk Resend Error:', error.message);
    res.status(500).json({ message: 'Bulk resend error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 📦 Bulk Resend by IDs
// ═══════════════════════════════════════════════════════════
exports.bulkResendSmsByIds = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'IDs list ලබාදෙන්න.' });
  }

  try {
    let successCount = 0;
    for (const logId of ids) {
      const logResult = await db.pool.query('SELECT * FROM WhatsApp_Logs WHERE log_id = $1', [logId]);
      if (logResult.rows.length > 0) {
        const log = logResult.rows[0];
        const result = await sendWhatsAppMessage(log.parent_phone, log.message_body);
        if (result.success) {
          await db.pool.query(`UPDATE WhatsApp_Logs SET status = 'Sent', whatsapp_status = 'Sent' WHERE log_id = $1`, [logId]);
          successCount++;
        }
      }
    }
    await auditService.logAction(req.user.userId, req.user.role, 'BULK_RESEND_WA_IDS', 'WhatsApp_Logs', null, `Bulk resent ${successCount} WhatsApp messages.`);
    res.status(200).json({ message: `සාර්ථකයි! ${successCount} messages නැවත යවන ලදී.` });
  } catch (error) {
    res.status(500).json({ message: 'Bulk resend error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 💬 Custom WhatsApp Message
// ═══════════════════════════════════════════════════════════
exports.sendCustomSms = async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ message: 'දුරකථන අංකය සහ පණිවිඩය ඇතුළත් කරන්න.' });
  }

  try {
    const result = await smsService.sendCustomSMS(phone, message);
    if (result.success) {
      await auditService.logAction(req.user.userId, req.user.role, 'SEND_CUSTOM_WA', 'WhatsApp_Logs', null, `Custom WhatsApp sent to ${phone}.`);
      res.status(200).json({ success: true, message: 'WhatsApp message සාර්ථකව යවන ලදී.' });
    } else {
      res.status(400).json({ success: false, message: 'WhatsApp message යැවීමට අසමත් විය.' });
    }
  } catch (error) {
    console.error('❌ Send Custom WhatsApp Error:', error.message);
    res.status(500).json({ success: false, message: 'WhatsApp message යැවීමේදී දෝෂයක් ඇති විය.', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 📢 Bulk Reminder (Admin/Counter Person)
// ═══════════════════════════════════════════════════════════
exports.sendReminderWhatsApp = async (req, res) => {
  const { student_ids, message_type, custom_message, course_id } = req.body;

  if (!student_ids || student_ids.length === 0) {
    return res.status(400).json({ message: 'ශිෂ්‍යයන් තෝරන්න.' });
  }

  // Default message templates. {class_name} and {month}/{date} are filled in per-student
  // by smsService.sendBulkReminder (class/exam-date/payment-month vary per student, so they
  // can't be resolved once up here the way {student_name}/{parent_name} are).
  const templates = {
    payment:
      `💰 *Thusitha Institute — ගෙවීම් සිහිකැඳවීම*\n\n` +
      `👤 {student_name} ({class_name}) ගේ {month} මාසයේ ගෙවීම් ශේෂය ඇත.\n` +
      `කරුණාකර ඉක්මනින් ගෙවීම සිදු කරන්න.\n\n` +
      `📞 _Thusitha Institute_`,
    exam:
      `📝 *Thusitha Institute — විභාග දැනුම්දීම*\n\n` +
      `👤 {student_name} ({class_name}) සඳහා {date} දින ඉදිරි විභාගය පවතී.\n` +
      `කරුණාකර හොඳින් සූදානම් වන්න! 📚\n\n` +
      `📞 _Thusitha Institute_`,
    // Was missing entirely - message_type:'attendance' from the frontend silently fell
    // back to `templates.general` below, sending the wrong wording for this type.
    attendance:
      `📋 *Thusitha Institute — පැමිණීම් දැනුම්දීම*\n\n` +
      `👤 {student_name} ({class_name}) ගේ {date} දිනයේ පැමිණීම සම්බන්ධව දැනුම්දීමක් ඇත.\n` +
      `කරුණාකර ආයතනය හා සම්බන්ධ වන්න.\n\n` +
      `📞 _Thusitha Institute_`,
    general:
      `📢 *Thusitha Institute — දැනුම්දීම*\n\n` +
      `👤 {student_name} ගේ මව්පිය,\n\n` +
      `{custom_message}\n\n` +
      `📞 _Thusitha Institute_`
  };

  const template = message_type === 'custom'
    ? (custom_message || 'N/A')
    : (templates[message_type] || templates.general).replace('{custom_message}', custom_message || '');

  try {
    const results = await smsService.sendBulkReminder(student_ids, template, message_type || 'General', course_id || null);

    await auditService.logAction(
      req.user.userId, req.user.role, 'BULK_WA_REMINDER', 'WhatsApp_Logs', null,
      `Bulk WhatsApp reminder: ${results.sent} sent, ${results.failed} failed. Type: ${message_type}`
    );

    res.status(200).json({
      success: true,
      message: `✅ ${results.sent} WhatsApp messages සාර්ථකව යවන ලදී. ❌ ${results.failed} අසාර්ථකයි.`,
      sent: results.sent,
      failed: results.failed,
      details: results.details
    });
  } catch (error) {
    console.error('❌ Bulk Reminder Error:', error.message);
    res.status(500).json({ message: 'Bulk WhatsApp reminder error', error: error.message });
  }
};