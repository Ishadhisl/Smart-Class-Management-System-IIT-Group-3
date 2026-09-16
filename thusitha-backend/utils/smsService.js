/**
 * 📤 WhatsApp Messaging Service (utils/whatsappService.js, backed by Baileys)
 * SMS/Twilio was evaluated early on and dropped for cost - every send in this file goes
 * over WhatsApp only. Kept the "sms" name on this file/these functions to keep the diff
 * small when the channel was switched; see database/schema.sql's WhatsApp_Logs table.
 */

const db = require('../db');
const { sendWhatsAppMessage } = require('./whatsappService');

// ═══════════════════════════════════════════════════════════
// 📝 DB Log Helper
// ═══════════════════════════════════════════════════════════
const logMessage = async (parentId, phone, type, body, whatsappStatus, parentName = null) => {
  try {
    await db.pool.query(
      `INSERT INTO WhatsApp_Logs
       (parent_id, parent_phone, message_type, message_body, status, whatsapp_status, channel, parent_name, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        parentId,
        phone,
        type,
        body,
        whatsappStatus,        // status column = WhatsApp status (main channel now)
        whatsappStatus,        // whatsapp_status column
        'WhatsApp',
        parentName
      ]
    );
  } catch (err) {
    console.error('❌ Message Log Error:', err.message);
  }
};

// ═══════════════════════════════════════════════════════════
// 🎯 Attendance WhatsApp Message
// ═══════════════════════════════════════════════════════════
exports.sendAttendanceSMS = async (studentId, courseName, timeString, status) => {
  try {
    const parentRes = await db.pool.query(
      `SELECT p.parent_id, p.parent_phone, p.parent_name, s.student_name 
       FROM Students s 
       JOIN Parents p ON s.parent_id = p.parent_id 
       WHERE s.student_id = $1`,
      [studentId]
    );
    if (parentRes.rows.length === 0) return;

    const { parent_id, parent_phone, parent_name, student_name } = parentRes.rows[0];
    
    const messageBody = 
      `📚 *Thusitha Institute*\n\n` +
      `👤 ${student_name}\n` +
      `📖 ${courseName}\n` +
      `⏰ ${timeString}\n` +
      `📋 Status: *${status === 'Present' ? '✅ Present' : '❌ Absent'}*\n\n` +
      `_Thusitha Institute — Smart Class System_`;

    const result = await sendWhatsAppMessage(parent_phone, messageBody);
    const waStatus = result.success ? 'Sent' : 'Failed';
    
    await logMessage(parent_id, parent_phone, 'Attendance', messageBody, waStatus, parent_name || student_name + "'s Parent");
  } catch (error) {
    console.error('❌ sendAttendanceSMS Error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════
// 💰 Payment Reminder WhatsApp Message
// ═══════════════════════════════════════════════════════════
exports.sendLatePaymentSMS = async (studentId, studentName, parentPhone, courseName, month) => {
  try {
    const messageBody = 
      `💰 *Thusitha Institute — ගෙවීම් සිහිකැඳවීම*\n\n` +
      `👤 ශිෂ්‍ය: *${studentName}*\n` +
      `📚 පාඨමාලාව: ${courseName}\n` +
      `📅 මාසය: ${month}\n\n` +
      `⚠️ ගෙවීම තවම සිදු කර නොමැත.\n` +
      `කරුණාකර ඉක්මනින් ගෙවීම සිදු කරන්න.\n\n` +
      `📞 කාර්යාලය: _Thusitha Institute_`;

    const result = await sendWhatsAppMessage(parentPhone, messageBody);
    const waStatus = result.success ? 'Sent' : 'Failed';

    const parentRes = await db.pool.query(
      `SELECT p.parent_id, p.parent_name FROM Students s 
       JOIN Parents p ON s.parent_id = p.parent_id WHERE s.student_id = $1`,
      [studentId]
    );
    const parentId = parentRes.rows[0]?.parent_id;
    const parentName = parentRes.rows[0]?.parent_name;

    await logMessage(parentId, parentPhone, 'Payment', messageBody, waStatus, parentName);
  } catch (error) {
    console.error('❌ sendLatePaymentSMS Error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════
// 🔒 Security Alert WhatsApp Message
// ═══════════════════════════════════════════════════════════
exports.sendDiscrepancySMS = async (parentPhone, studentName, courseName) => {
  try {
    const messageBody = 
      `🔒 *Thusitha Institute — ආරක්ෂක දැනුම්දීම*\n\n` +
      `👤 ශිෂ්‍ය: *${studentName}*\n` +
      `📖 ${courseName}\n\n` +
      `⚠️ *පැමිණීමේ විෂමතාවයක් හඳුනා ගන්නා ලදී.*\n` +
      `කරුණාකර ඉක්මනින් ආයතනය හා සම්බන්ධ වන්න.\n\n` +
      `📞 _Thusitha Institute_`;

    const result = await sendWhatsAppMessage(parentPhone, messageBody);
    const waStatus = result.success ? 'Sent' : 'Failed';

    const parentRes = await db.pool.query(
      'SELECT parent_id, parent_name FROM Parents WHERE parent_phone = $1', [parentPhone]
    );
    const parentId = parentRes.rows[0]?.parent_id;
    const parentName = parentRes.rows[0]?.parent_name;

    await logMessage(parentId, parentPhone, 'Security', messageBody, waStatus, parentName);
  } catch (error) {
    console.error('❌ sendDiscrepancySMS Error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════
// 💬 Custom WhatsApp Message
// ═══════════════════════════════════════════════════════════
exports.sendCustomSMS = async (phone, body) => {
  try {
    const result = await sendWhatsAppMessage(phone, body);
    const waStatus = result.success ? 'Sent' : 'Failed';

    const parentRes = await db.pool.query(
      'SELECT parent_id, parent_name FROM Parents WHERE parent_phone = $1', [phone]
    );
    const parentId = parentRes.rows[0]?.parent_id;
    const parentName = parentRes.rows[0]?.parent_name;

    await logMessage(parentId, phone, 'Custom', body, waStatus, parentName);
    return { success: result.success };
  } catch (error) {
    console.error('❌ sendCustomSMS Error:', error.message);
    return { success: false };
  }
};

// ═══════════════════════════════════════════════════════════
// 🎓 Exam Result WhatsApp Message
// ═══════════════════════════════════════════════════════════
exports.sendExamResultSMS = async (studentId, examName, marks, totalMarks) => {
  try {
    const parentRes = await db.pool.query(
      `SELECT p.parent_id, p.parent_phone, p.parent_name, s.student_name 
       FROM Students s 
       JOIN Parents p ON s.parent_id = p.parent_id 
       WHERE s.student_id = $1`,
      [studentId]
    );
    if (parentRes.rows.length === 0) return;

    const { parent_id, parent_phone, parent_name, student_name } = parentRes.rows[0];
    const percentage = ((marks / totalMarks) * 100).toFixed(1);
    const grade = percentage >= 75 ? '🏆 A' : percentage >= 65 ? '✅ B' : percentage >= 55 ? '📘 C' : percentage >= 40 ? '📗 S' : '❌ F';
    
    const messageBody = 
      `📊 *Thusitha Institute — විභාග ප්‍රතිඵල*\n\n` +
      `👤 ශිෂ්‍ය: *${student_name}*\n` +
      `📝 විභාගය: ${examName}\n` +
      `🎯 ලකුණු: *${marks}/${totalMarks}* (${percentage}%)\n` +
      `🏅 ශ්‍රේණිය: ${grade}\n\n` +
      `_Thusitha Institute — Smart Class System_`;

    const result = await sendWhatsAppMessage(parent_phone, messageBody);
    const waStatus = result.success ? 'Sent' : 'Failed';

    await logMessage(parent_id, parent_phone, 'Exam', messageBody, waStatus, parent_name);
  } catch (error) {
    console.error('❌ sendExamResultSMS Error:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════
// 📢 Bulk Reminder WhatsApp Message (Admin/Counter Person)
// ═══════════════════════════════════════════════════════════
const SINHALA_MONTHS = [
  'ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි',
  'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'
];
const formatDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

// Resolves the {class_name} / {month} / {date} placeholders for one student. Separate
// per-student lookup (rather than once for the whole batch) because different students in
// the same send can be enrolled in different courses with different upcoming exam dates.
const resolveTemplateVars = async (studentId, messageType, courseId) => {
  let className = 'N/A';
  let resolvedCourseId = courseId || null;
  try {
    const courseRes = await db.pool.query(
      `SELECT c.course_id, c.course_name
       FROM Course_Enrollments ce
       JOIN Courses c ON ce.course_id = c.course_id
       WHERE ce.student_id = $1 AND ce.enrollment_status IN ('Active', 'Enrolled')
       ${courseId ? 'AND ce.course_id = $2' : ''}
       ORDER BY ce.enrolled_at ASC LIMIT 1`,
      courseId ? [studentId, courseId] : [studentId]
    );
    if (courseRes.rows.length > 0) {
      className = courseRes.rows[0].course_name;
      resolvedCourseId = courseRes.rows[0].course_id;
    }
  } catch (err) {
    console.warn(`⚠️ [Reminder] class lookup failed for student ${studentId}:`, err.message);
  }

  const now = new Date();
  let dateOrMonth = '';
  if (messageType === 'payment') {
    // The reminder is about the currently-running month's fee, not a ledger balance lookup.
    dateOrMonth = `${SINHALA_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  } else if (messageType === 'exam') {
    if (resolvedCourseId) {
      try {
        const examRes = await db.pool.query(
          `SELECT exam_date FROM Exams WHERE course_id = $1 AND exam_date >= CURRENT_DATE ORDER BY exam_date ASC LIMIT 1`,
          [resolvedCourseId]
        );
        if (examRes.rows.length > 0) dateOrMonth = formatDate(new Date(examRes.rows[0].exam_date));
      } catch (err) {
        console.warn(`⚠️ [Reminder] exam date lookup failed for student ${studentId}:`, err.message);
      }
    }
    if (!dateOrMonth) dateOrMonth = 'ළඟදීම'; // no scheduled exam found - fall back to "soon"
  } else if (messageType === 'attendance') {
    // The alert is about today's attendance, so today's date is the relevant one.
    dateOrMonth = formatDate(now);
  }

  return { className, dateOrMonth };
};

exports.sendBulkReminder = async (studentIds, messageTemplate, messageType, courseId = null) => {
  const results = { sent: 0, failed: 0, details: [] };

  for (const studentId of studentIds) {
    try {
      const res = await db.pool.query(
        `SELECT s.student_name, p.parent_phone, p.parent_id, p.parent_name
         FROM Students s
         JOIN Parents p ON s.parent_id = p.parent_id
         WHERE s.student_id = $1`,
        [studentId]
      );
      if (res.rows.length === 0) continue;

      const { student_name, parent_phone, parent_id, parent_name } = res.rows[0];
      const { className, dateOrMonth } = await resolveTemplateVars(studentId, messageType, courseId);

      // Template variables replace කිරීම
      const finalMessage = messageTemplate
        .replace(/{student_name}/g, student_name)
        .replace(/{parent_name}/g, parent_name || 'මව්පිය')
        .replace(/{class_name}/g, className)
        .replace(/{month}/g, dateOrMonth)
        .replace(/{date}/g, dateOrMonth);

      const result = await sendWhatsAppMessage(parent_phone, finalMessage);
      const waStatus = result.success ? 'Sent' : 'Failed';

      await logMessage(parent_id, parent_phone, messageType, finalMessage, waStatus, parent_name);

      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
      }
      results.details.push({ studentId, student_name, parent_phone, status: waStatus });

      // Rate limiting: messages between 1-2 seconds apart
      await new Promise(resolve => setTimeout(resolve, 1200));
    } catch (err) {
      console.error(`❌ Bulk send error for student ${studentId}:`, err.message);
      results.failed++;
    }
  }

  return results;
};