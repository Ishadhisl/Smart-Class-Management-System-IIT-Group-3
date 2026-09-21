const crypto = require('crypto');
const fs = require('fs');
const db = require('../db');
const auditService = require('../utils/auditService');
const smsService = require('../utils/smsService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51Px_placeholder'); // Use env in prod
const { sanitizeText } = require('../utils/validators');

// 'Pending Verification' = bank-slip upload awaiting admin review; 'Pending' = PayHere
// checkout started but the gateway's notify callback hasn't confirmed it yet (on a
// localhost backend PayHere can never reach notify_url, so those stay Pending until an
// Admin/Counter Person approves them from the Payments tab).
const PAYMENT_STATUSES = ['Completed', 'Rejected', 'Pending Verification', 'Pending'];
const VERIFY_TARGET_STATUSES = ['Completed', 'Rejected'];

// PayHere hash generator: strtoupper(md5(merchant_id + order_id + amount_formatted + currency + strtoupper(md5(merchant_secret))))
const generatePayHereHash = (merchantId, orderId, amount, currency, merchantSecret) => {
  const formattedAmount = Number(amount).toFixed(2);
  const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const hashString = `${merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
  return crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();
};

// PayHere callback signature verifier: strtoupper(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret))))
const verifyPayHereSignature = (merchantId, orderId, payhereAmount, payhereCurrency, statusCode, merchantSecret, receivedSig) => {
  const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const checkString = `${merchantId}${orderId}${payhereAmount}${payhereCurrency}${statusCode}${hashedSecret}`;
  const localSig = crypto.createHash('md5').update(checkString).digest('hex').toUpperCase();
  return localSig === (receivedSig || '').toUpperCase();
};

// 🔒 Resolves the caller's own student_id (for role 'Student') from their user_id.
// Returns null if the role isn't 'Student' or no matching Students row exists.
const resolveOwnStudentId = async (req) => {
  if (!req.user || req.user.role !== 'Student') return null;
  const result = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
  return result.rows[0]?.student_id || null;
};

// 🔒 Checks whether targetStudentId is one of the logged-in Parent's own children.
const isOwnChild = async (req, targetStudentId) => {
  if (!req.user || req.user.role !== 'Parent') return false;
  const result = await db.pool.query(
    `SELECT 1 FROM Students s JOIN Parents p ON s.parent_id = p.parent_id
     WHERE p.user_id = $1 AND s.student_id = $2`,
    [req.user.userId, targetStudentId]
  );
  return result.rows.length > 0;
};

exports.createStripeSession = async (req, res) => {
  const { student_id, course_id, amount_paid, for_month } = req.body;

  if (!student_id || !course_id || !amount_paid || !for_month) {
    return res.status(400).json({ message: "Missing required payment fields." });
  }

  let resolvedStudentId = student_id;
  try {
    if (req.user && req.user.role === 'Student') {
      const studentRes = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentRes.rows.length === 0) {
        return res.status(404).json({ message: "ශිෂ්‍යයා සොයාගත නොහැක." });
      }
      resolvedStudentId = studentRes.rows[0].student_id;
    }

    // 🔒 Never trust a client-supplied amount for money that gets charged/recorded -
    // look up the course's real fee and use that instead of req.body.amount_paid.
    const courseRes = await db.pool.query('SELECT monthly_fee FROM Courses WHERE course_id = $1', [course_id]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: "පාඨමාලාව හමුවුනේ නැත." });
    }
    const courseFee = Number(courseRes.rows[0].monthly_fee);

    // Check for existing payment
    const existingPayment = await db.pool.query(
      `SELECT * FROM Payments WHERE student_id = $1 AND course_id = $2 AND for_month = $3 AND payment_status IN ('Completed', 'Pending Verification')`,
      [resolvedStudentId, course_id, for_month]
    );
    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ message: "මෙම මාසය සඳහා අදාළ පන්තියට දැනටමත් ගෙවීමක් කර ඇත." });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_51Px_placeholder';
    const successUrl = `https://localhost:5173/dashboard?payment=success&course=${course_id}&month=${for_month}`;

    // If we only have the placeholder key, simulate a dummy sandbox payment success URL
    if (stripeKey === 'sk_test_51Px_placeholder') {
      console.log('⚠️ Using Stripe Sandbox Dummy Mode');

      const tempReceipt = `DUMMY-${Date.now().toString().slice(-6)}`;
      const query = `
        INSERT INTO Payments (student_id, course_id, issued_by, amount_paid, payment_method, for_month, receipt_number, payment_status)
        VALUES ($1, $2, NULL, $3, 'Card (Dummy)', $4, $5, 'Completed')
      `;
      await db.pool.query(query, [resolvedStudentId, course_id, courseFee, for_month, tempReceipt]);

      return res.json({ dummy_success: true, message: 'Dummy payment recorded.' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'lkr',
          product_data: { name: `Course Payment: ${for_month}` },
          unit_amount: Math.round(courseFee * 100), // Stripe expects cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: `https://localhost:5173/dashboard?payment=cancel`,
      metadata: { student_id: resolvedStudentId, course_id, for_month, amount_paid: courseFee }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Stripe Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.recordPayment = async (req, res) => {
  const { student_id, course_id, amount_paid, payment_method, for_month } = req.body;
  
  // The ID of the Admin/Counter Staff who is logged in
  const issued_by = req.user.userId;

  if (!student_id || !course_id || !amount_paid || !for_month) {
    return res.status(400).json({ message: "අත්‍යවශ්‍ය සියලුම දත්ත (ශිෂ්‍යයා, පන්තිය, මුදල, මාසය) ඇතුළත් කරන්න." });
  }

  try {
    // Check for duplicate payment for same student/course/month
    const dupCheck = await db.pool.query(
      `SELECT * FROM Payments WHERE student_id = $1 AND course_id = $2 AND for_month = $3 AND payment_status IN ('Completed', 'Pending Verification')`,
      [student_id, course_id, for_month]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ message: "මෙම මාසය සඳහා අදාළ පන්තියට දැනටමත් ගෙවීමක් කර ඇත." });
    }

    // Auto-generate receipt number: RCP-YYYYMMDD-XXXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
    const seqResult = await db.pool.query('SELECT COUNT(*) as cnt FROM Payments WHERE DATE(payment_date) = CURRENT_DATE');
    const seq = String(Number(seqResult.rows[0].cnt) + 1).padStart(5, '0');
    const receipt_number = `RCP-${dateStr}-${seq}`;

    const query = `
      INSERT INTO Payments (student_id, course_id, issued_by, amount_paid, payment_method, for_month, receipt_number, payment_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Completed')
      RETURNING *
    `;
    const values = [student_id, course_id, issued_by, amount_paid, payment_method || 'Cash', for_month, receipt_number];
    
    const result = await db.pool.query(query, values);

    res.status(201).json({
      message: 'ගෙවීම සාර්ථකව සටහන් කරන ලදී.',
      payment: result.rows[0]
    });
    await auditService.logAction(issued_by, req.user.role, 'CREATE', 'Payment', result.rows[0].payment_id, `Recorded payment of Rs.${amount_paid} for student ${student_id} for ${for_month}. Receipt: ${receipt_number}`);
  } catch (error) {
    console.error('❌ Payment Recording Error:', error.message);
    res.status(500).json({ message: "ගෙවීම් සටහන් කිරීම අසාර්ථකයි.", error: error.message });
  }
};

exports.getStudentPayments = async (req, res) => {
  let { studentId } = req.params;
  try {
    if (req.user && req.user.role === 'Student') {
      const ownId = await resolveOwnStudentId(req);
      if (!ownId) return res.status(404).json({ message: "ශිෂ්‍යයා සොයාගත නොහැක." });
      studentId = ownId;
    } else if (req.user && req.user.role === 'Parent') {
      if (!(await isOwnChild(req, studentId))) {
        return res.status(403).json({ message: "ප්‍රවේශය තහනම්: මෙය ඔබගේ දරුවෙකුගේ ගිණුමක් නොවේ." });
      }
    }

    const query = `
      SELECT p.*, c.course_name, s.student_name, u.username as issued_by_name
      FROM Payments p
      JOIN Courses c ON p.course_id = c.course_id
      JOIN Students s ON p.student_id = s.student_id
      LEFT JOIN Users u ON p.issued_by = u.user_id
      WHERE p.student_id = $1
      ORDER BY p.payment_date DESC
    `;
    const result = await db.pool.query(query, [studentId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get Student Payments Error:', error.message);
    res.status(500).json({ message: "ගෙවීම් විස්තර ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

// හිඟ මුදල් සහිත සිසුන් සොයා මතක් කිරීම් WhatsApp යැවීම
exports.sendLatePaymentReminders = async (req, res) => {
  const { course_id, for_month } = req.body;

  if (!course_id || !for_month) {
    return res.status(400).json({ message: "පන්තිය සහ මාසය තෝරා ගැනීම අනිවාර්ය වේ." });
  }

  try {
    // 1. පන්තියට ඇතුළත් වූ නමුත් අදාළ මාසය සඳහා ගෙවීම් නොකළ සිසුන් සෙවීම
    const query = `
      SELECT s.student_id, s.student_name, p.parent_phone, p.parent_name, c.course_name
      FROM Course_Enrollments ce
      JOIN Students s ON ce.student_id = s.student_id
      JOIN Parents p ON s.parent_id = p.parent_id
      JOIN Courses c ON ce.course_id = c.course_id
      WHERE ce.course_id = $1
        AND ce.enrollment_status IN ('Enrolled', 'Active')
        AND NOT EXISTS (
          SELECT 1 FROM Payments pay
          WHERE pay.student_id = ce.student_id
            AND pay.course_id = ce.course_id
            AND pay.for_month = $2
        )
    `;
    const result = await db.pool.query(query, [course_id, for_month]);

    const { sendWhatsAppMessage } = require('../utils/whatsappService');
    
    let sentCount = 0;
    // 2. එක් එක් ශිෂ්‍යයා සඳහා WhatsApp යැවීම
    for (const student of result.rows) {
      if (student.parent_phone) {
        const message = `💰 *Thusitha Institute — ගෙවීම් සිහිකැඳවීම*\n\nආදරණීය දෙමාපිය,\n\nඔබගේ දරුවා *${student.student_name}* ගේ *${student.course_name}* පන්තිය සඳහා *${for_month}* මාසයේ ගාස්තුව තවමත් ගෙවා නොමැත.\nකරුණාකර ඉක්මනින් ආයතනයට ගොස් ගෙවීම සිදු කරන්න.\n\n📞 _Thusitha Institute_`;
        
        await sendWhatsAppMessage(student.parent_phone, message);
        sentCount++;
      }
    }

    res.json({ 
      message: `සාර්ථකයි! හිඟ මුදල් සහිත සිසුන් ${sentCount} දෙනෙකුගේ මව්පියන්ට මතක් කිරීමේ (Late Payment) WhatsApp පණිවිඩ යවන ලදී.` 
    });
  } catch (error) {
    console.error('❌ Reminders Error:', error.message);
    res.status(500).json({ message: "මතක් කිරීම් යැවීමට නොහැකි විය.", error: error.message });
  }
};

/**
 * 🧾 Upload Bank Slip / Confirmation
 */
exports.uploadConfirmation = async (req, res) => {
  const { id } = req.params;
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : req.body.slip_url;

  if (!fileUrl) return res.status(400).json({ message: "කරුණාකර ගෙවීම් පත්‍රිකාව (Slip) උඩුගත කරන්න." });
  // A client-supplied slip_url (no file) is later rendered as a receipt link - reject
  // anything that isn't a same-origin upload path or a plain http(s) URL, so a
  // javascript:/data: scheme can never end up stored as a clickable link.
  if (!req.file && !/^(\/uploads\/|https?:\/\/)/i.test(fileUrl)) {
    return res.status(400).json({ message: "වලංගු නොවන ගොනු ලිපිනයකි." });
  }

  try {
    if (req.user && (req.user.role === 'Student' || req.user.role === 'Parent')) {
      const ownerCheck = await db.pool.query('SELECT student_id FROM Payments WHERE payment_id = $1', [id]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ message: "ගෙවීම හමුවුනේ නැත." });
      const paymentStudentId = ownerCheck.rows[0].student_id;

      const ownId = req.user.role === 'Student' ? await resolveOwnStudentId(req) : null;
      const authorized = req.user.role === 'Student'
        ? ownId === paymentStudentId
        : await isOwnChild(req, paymentStudentId);
      if (!authorized) {
        return res.status(403).json({ message: "ප්‍රවේශය තහනම්: මෙය ඔබගේ ගෙවීමක් නොවේ." });
      }
    }

    await db.pool.query(
      "UPDATE Payments SET confirmation_url = $1, payment_status = 'Pending Verification' WHERE payment_id = $2",
      [fileUrl, id]
    );
    res.status(200).json({ message: "ගෙවීම් පත්‍රිකාව සාර්ථකව උඩුගත කරන ලදී.", url: fileUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✅ Verify Pending Payment
 */
exports.verifyPayment = async (req, res) => {
  const { id } = req.params;
  let { comments } = req.body;
  const { status } = req.body; // 'Completed' or 'Rejected'

  if (!VERIFY_TARGET_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VERIFY_TARGET_STATUSES.join(', ')}` });
  }
  comments = comments ? sanitizeText(comments, 500) : null;

  try {
    await db.pool.query(
      "UPDATE Payments SET payment_status = $1, verification_comments = $2 WHERE payment_id = $3",
      [status, comments, id]
    );
    await auditService.logAction(req.user?.userId, req.user?.role, 'UPDATE', 'Payment', id, `Payment ${id} verified as ${status}.`);
    res.status(200).json({ message: `ගෙවීම ${status} ලෙස තහවුරු කරන ලදී.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🧾 Get Payment Receipt Details
 */
exports.getReceipt = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT p.*, c.course_name, s.student_name, u.username as issued_by_name
      FROM Payments p
      JOIN Courses c ON p.course_id = c.course_id
      JOIN Students s ON p.student_id = s.student_id
      LEFT JOIN Users u ON p.issued_by = u.user_id
      WHERE p.payment_id = $1
    `;
    const result = await db.pool.query(query, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "රසීදුව හමුවුනේ නැත." });

    if (req.user && (req.user.role === 'Student' || req.user.role === 'Parent')) {
      const paymentStudentId = result.rows[0].student_id;
      const ownId = req.user.role === 'Student' ? await resolveOwnStudentId(req) : null;
      const authorized = req.user.role === 'Student'
        ? ownId === paymentStudentId
        : await isOwnChild(req, paymentStudentId);
      if (!authorized) {
        return res.status(403).json({ message: "ප්‍රවේශය තහනම්: මෙය ඔබගේ රසීදුවක් නොවේ." });
      }
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ⏳ Get Overdue Payments
 */
exports.getOverduePayments = async (req, res) => {
  // month = English month name as stored in Payments.for_month ("June"; "June 2026" also
  // matches via prefix). course_id narrows to one class (used by the WhatsApp reminder).
  const { month, course_id } = req.query;
  if (!month) {
    return res.status(400).json({ error: 'month අනිවාර්ය වේ.' });
  }

  try {
    const params = [month];
    if (course_id) params.push(course_id);
    const query = `
      SELECT ce.student_id, s.student_name, s.qr_code_key, c.course_id, c.course_name, p.parent_name, p.parent_phone
      FROM Course_Enrollments ce
      JOIN Students s ON ce.student_id = s.student_id
      LEFT JOIN Parents p ON s.parent_id = p.parent_id
      JOIN Courses c ON ce.course_id = c.course_id
      WHERE ce.enrollment_status IN ('Enrolled', 'Active')
        ${course_id ? 'AND ce.course_id = $2' : ''}
        AND NOT EXISTS (
          SELECT 1 FROM Payments pay
          WHERE pay.student_id = ce.student_id
            AND pay.course_id = ce.course_id
            AND LOWER(pay.for_month) LIKE LOWER($1) || '%'
            AND pay.payment_status IN ('Completed', 'Pending Verification')
        )
      ORDER BY c.course_name, s.student_name
    `;
    const result = await db.pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🧾 Submit Manual Payment (Student)
 */
exports.submitManualPayment = async (req, res) => {
  const { student_id, course_id, amount_paid, for_month } = req.body;
  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!student_id || !course_id || !amount_paid || !for_month) {
    return res.status(400).json({ message: "Missing required payment fields." });
  }
  if (!fileUrl) {
    return res.status(400).json({ message: "කරුණාකර බැංකු රිසිට් පත උඩුගත කරන්න." });
  }

  let resolvedStudentId = student_id;
  const client = await db.pool.connect();
  try {
    if (req.user && req.user.role === 'Student') {
      const studentRes = await client.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentRes.rows.length === 0) {
        return res.status(404).json({ message: "ශිෂ්‍යයා සොයාගත නොහැක." });
      }
      resolvedStudentId = studentRes.rows[0].student_id;
    }

    await client.query('BEGIN');

    // Serialize concurrent submissions for the same student/course/month so a
    // double-click (or slow-network double-tap) can't slip two requests past
    // the existing-payment check before either one commits its INSERT.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`payment-${resolvedStudentId}-${course_id}-${for_month}`]
    );

    // Check for existing payment
    const existingPayment = await client.query(
      `SELECT * FROM Payments WHERE student_id = $1 AND course_id = $2 AND for_month = $3 AND payment_status IN ('Completed', 'Pending Verification')`,
      [resolvedStudentId, course_id, for_month]
    );
    if (existingPayment.rows.length > 0) {
      await client.query('ROLLBACK');
      // The file for this rejected duplicate submission is never referenced anywhere; remove it.
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "මෙම මාසය සඳහා අදාළ පන්තියට දැනටමත් ගෙවීමක් කර ඇත." });
    }

    // Generate a temporary receipt number
    const tempReceipt = `MANUAL-${Date.now().toString().slice(-6)}`;

    const query = `
      INSERT INTO Payments (student_id, course_id, issued_by, amount_paid, payment_method, for_month, receipt_number, confirmation_url, payment_status)
      VALUES ($1, $2, NULL, $3, 'Bank Transfer', $4, $5, $6, 'Pending Verification')
      RETURNING *
    `;
    const values = [resolvedStudentId, course_id, amount_paid, for_month, tempReceipt, fileUrl];

    const result = await client.query(query, values);
    await client.query('COMMIT');

    res.status(201).json({
      message: 'ගෙවීම් රිසිට් පත සාර්ථකව උඩුගත කරන ලදී. තහවුරු කරන තෙක් රැඳී සිටින්න.',
      payment: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Manual Payment Submission Error:', error.message);
    res.status(500).json({ message: "ගෙවීම ඉදිරිපත් කිරීම අසාර්ථකයි.", error: error.message });
  } finally {
    client.release();
  }
};

/**
 * 🔍 Get All Payments with filters (Course, Month, Search by Student name/QR)
 */
exports.getAllPayments = async (req, res) => {
  const { course_id, for_month, search } = req.query;
  const role = req.user?.role;
  const userId = req.user?.userId;

  try {
    let query = `
      SELECT p.*, c.course_name, s.student_name, s.qr_code_key, u.username as issued_by_name
      FROM Payments p
      JOIN Courses c ON p.course_id = c.course_id
      JOIN Students s ON p.student_id = s.student_id
      LEFT JOIN Users u ON p.issued_by = u.user_id
    `;
    const values = [];
    let valIndex = 1;

    if (role === 'Teacher') {
      query += ` JOIN Teachers t ON c.teacher_id = t.teacher_id WHERE t.user_id = $${valIndex}`;
      values.push(userId);
      valIndex++;
    } else {
      query += ` WHERE 1=1`;
    }

    if (course_id) {
      query += ` AND p.course_id = $${valIndex}`;
      values.push(course_id);
      valIndex++;
    }

    if (for_month) {
      query += ` AND p.for_month = $${valIndex}`;
      values.push(for_month);
      valIndex++;
    }

    if (search) {
      query += ` AND (s.student_name ILIKE $${valIndex} OR s.qr_code_key ILIKE $${valIndex})`;
      values.push(`%${search}%`);
      valIndex++;
    }

    query += ` ORDER BY p.payment_date DESC LIMIT 100`;

    const result = await db.pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Get All Payments Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// PAYHERE PAYMENT GATEWAY INTEGRATION
// ============================================

/**
 * 🔒 Initiate PayHere Checkout
 * Generates required params and MD5 hash server-side, records a 'Pending' payment in DB.
 */
exports.initiatePayHereCheckout = async (req, res) => {
  const { course_id, for_month } = req.body;
  let student_id = req.body.student_id;

  try {
    if (req.user && req.user.role === 'Student') {
      const ownId = await resolveOwnStudentId(req);
      if (!ownId) {
        return res.status(404).json({ message: "ශිෂ්‍යයා සොයාගත නොහැක." });
      }
      student_id = ownId;
    }

    if (!student_id || !course_id || !for_month) {
      return res.status(400).json({ message: "අත්‍යවශ්‍ය සියලු දත්ත (course_id, for_month) ඇතුළත් කරන්න." });
    }

    // Look up the course
    const courseRes = await db.pool.query('SELECT course_id, course_name, monthly_fee FROM Courses WHERE course_id = $1', [course_id]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: "පාඨමාලාව හමුවුනේ නැත." });
    }
    const course = courseRes.rows[0];
    const courseFee = Number(course.monthly_fee);

    // Check for existing completed or pending verification payment
    const existingPayment = await db.pool.query(
      `SELECT * FROM Payments WHERE student_id = $1 AND course_id = $2 AND for_month = $3 AND payment_status IN ('Completed', 'Pending Verification')`,
      [student_id, course_id, for_month]
    );
    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ message: "මෙම මාසය සඳහා අදාළ පන්තියට දැනටමත් ගෙවීමක් කර ඇත." });
    }

    // Get student details for customer parameters required by PayHere
    const studentRes = await db.pool.query(
      `SELECT s.student_id, s.student_name, s.address, u.username, p.parent_name, p.parent_phone
       FROM Students s
       JOIN Users u ON s.user_id = u.user_id
       LEFT JOIN Parents p ON s.parent_id = p.parent_id
       WHERE s.student_id = $1`,
      [student_id]
    );
    const student = studentRes.rows[0] || {};
    const studentName = (student.student_name || student.username || 'Student').trim();
    const nameParts = studentName.split(/\s+/);
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || 'Student';
    const email = `${(student.username || 'student').toLowerCase().replace(/[^a-z0-9]/g, '')}${student_id}@scms.lk`;
    const phone = student.parent_phone || '0770000000';
    const address = student.address || 'Sri Lanka';
    const city = 'Colombo';
    const country = 'Sri Lanka';

    const merchantId = process.env.PAYHERE_MERCHANT_ID || '1238125';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || process.env.MERCHANT_SECRET || 'MjE2ODMzNjU2MjE1NTIwNzEwNDY2OTU3NTY1ODExMjAyODk4MTQ5';
    const mode = (process.env.PAYHERE_MODE || 'sandbox').toLowerCase();
    const actionUrl = mode === 'live'
      ? 'https://www.payhere.lk/pay/checkout'
      : 'https://sandbox.payhere.lk/pay/checkout';

    const orderId = `PH-${student_id}-${course_id}-${Date.now()}`;
    const currency = 'LKR';
    const formattedAmount = courseFee.toFixed(2);
    const hash = generatePayHereHash(merchantId, orderId, formattedAmount, currency, merchantSecret);

    // Dynamic return, cancel, and notify URLs
    const frontendOrigin = req.headers.origin
      || process.env.PROD_FRONTEND_URL
      || process.env.FRONTEND_URL
      || 'https://scms-frontend-lac.vercel.app';
    const returnUrl = `${frontendOrigin}/dashboard?payment=success&order_id=${orderId}&course_id=${course_id}&month=${encodeURIComponent(for_month)}`;
    const cancelUrl = `${frontendOrigin}/dashboard?payment=cancel&order_id=${orderId}`;

    const backendBase = process.env.BACKEND_PUBLIC_URL 
      || process.env.BACKEND_URL 
      || (req.headers['x-forwarded-host'] ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host']}` : `${req.protocol}://${req.get('host')}`);
    const notifyUrl = process.env.PAYHERE_NOTIFY_URL || `${backendBase}/api/payments/payhere/notify`;

    // Record pending payment in database
    await db.pool.query(
      `INSERT INTO Payments (student_id, course_id, issued_by, amount_paid, payment_method, for_month, receipt_number, payment_status)
       VALUES ($1, $2, NULL, $3, 'PayHere', $4, $5, 'Pending')`,
      [student_id, course_id, courseFee, for_month, orderId]
    );

    res.status(200).json({
      action_url: actionUrl,
      mode,
      params: {
        merchant_id: merchantId,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: notifyUrl,
        order_id: orderId,
        items: `${course.course_name} (${for_month})`,
        currency: currency,
        amount: formattedAmount,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        address: address,
        city: city,
        country: country,
        custom_1: String(student_id),
        custom_2: String(course_id),
        hash: hash
      }
    });
  } catch (error) {
    console.error('❌ PayHere Checkout Initiation Error:', error.message);
    res.status(500).json({ message: "PayHere ගෙවීම ආරම්භ කිරීම අසාර්ථකයි.", error: error.message });
  }
};

/**
 * 🔔 PayHere Server-to-Server Notify Callback
 * Validates md5sig checksum and marks the payment Completed upon status 2.
 */
exports.handlePayHereNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      method,
      status_message
    } = req.body;

    console.log(`🔔 PayHere notify callback received for order ${order_id}: status_code=${status_code}, amount=${payhere_amount}, payment_id=${payment_id}`);

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || process.env.MERCHANT_SECRET || 'MjE2ODMzNjU2MjE1NTIwNzEwNDY2OTU3NTY1ODExMjAyODk4MTQ5';
    const isSigValid = verifyPayHereSignature(merchant_id, order_id, payhere_amount, payhere_currency, status_code, merchantSecret, md5sig);

    if (!isSigValid) {
      console.error(`❌ PayHere notification rejected: Invalid signature for order ${order_id}`);
      return res.status(400).send('Invalid signature');
    }

    const statusCodeNum = parseInt(status_code, 10);

    if (statusCodeNum === 2) {
      // 2 = Success
      const paymentMethod = method ? `PayHere (${method})` : 'PayHere';
      const updateResult = await db.pool.query(
        `UPDATE Payments
         SET payment_status = 'Completed',
             payhere_payment_id = $1,
             payment_method = $2,
             verification_comments = $3
         WHERE receipt_number = $4
         RETURNING *`,
        [String(payment_id), paymentMethod, `PayHere Online Payment Successful. Payment ID: ${payment_id}`, order_id]
      );

      if (updateResult.rows.length > 0) {
        const payment = updateResult.rows[0];
        console.log(`✅ PayHere Payment Completed: Order ${order_id}, Payment ID: ${payment_id}`);
        try {
          await auditService.logAction(
            payment.student_id,
            'Student',
            'UPDATE',
            'Payment',
            payment.payment_id,
            `PayHere online payment completed. Amount: ${payhere_amount}, Order: ${order_id}`
          );
        } catch (auditErr) {
          console.warn('Audit log error:', auditErr.message);
        }
      } else {
        console.warn(`⚠️ PayHere update: No payment found with receipt_number=${order_id}`);
      }
    } else if (statusCodeNum === 0) {
      // 0 = Pending
      console.log(`⏳ PayHere Payment Pending: Order ${order_id}`);
    } else {
      // Failed / Canceled / Chargedback
      console.log(`❌ PayHere Payment ${status_message || 'Failed'}: Order ${order_id}, status_code=${status_code}`);
      await db.pool.query(
        `UPDATE Payments
         SET payment_status = 'Rejected',
             payhere_payment_id = $1,
             verification_comments = $2
         WHERE receipt_number = $3 AND payment_status != 'Completed'`,
        [String(payment_id || ''), `PayHere payment failed or cancelled: ${status_message || status_code}`, order_id]
      );
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ PayHere notify error:', error);
    return res.status(500).send('Internal Error');
  }
};

/**
 * 🔍 Check PayHere Payment Status
 * Allows frontend to query status for an order_id after returning from PayHere
 */
exports.getPayHerePaymentStatus = async (req, res) => {
  const { orderId } = req.params;
  try {
    const result = await db.pool.query(
      `SELECT p.*, c.course_name, s.student_name
       FROM Payments p
       JOIN Courses c ON p.course_id = c.course_id
       JOIN Students s ON p.student_id = s.student_id
       WHERE p.receipt_number = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "ගෙවීම් තොරතුරු හමුවුනේ නැත." });
    }

    const payment = result.rows[0];
    // 🔒 A student may only look up their own orders; parents only their children's.
    if (req.user.role === 'Student') {
      const ownId = await resolveOwnStudentId(req);
      if (!ownId || ownId !== payment.student_id) {
        return res.status(403).json({ message: "ප්‍රවේශය තහනම්: මෙය ඔබගේ ගෙවීමක් නොවේ." });
      }
    } else if (req.user.role === 'Parent') {
      if (!(await isOwnChild(req, payment.student_id))) {
        return res.status(403).json({ message: "ප්‍රවේශය තහනම්: මෙය ඔබගේ දරුවෙකුගේ ගෙවීමක් නොවේ." });
      }
    }

    res.status(200).json(payment);
  } catch (error) {
    console.error('❌ Get PayHere Payment Status Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};