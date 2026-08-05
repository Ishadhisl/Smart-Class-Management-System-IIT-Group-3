const db = require('../db');
const auditService = require('../utils/auditService');
const smsService = require('../utils/smsService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51Px_placeholder'); // Use env in prod

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

    // Check for existing payment
    const existingPayment = await db.pool.query(
      `SELECT * FROM Payments WHERE student_id = $1 AND course_id = $2 AND for_month = $3 AND payment_status IN ('Completed', 'Pending Verification')`,
      [resolvedStudentId, course_id, for_month]
    );
    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ message: "මෙම මාසය සඳහා අදාළ පන්තියට දැනටමත් ගෙවීමක් කර ඇත." });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_51Px_placeholder';
    const successUrl = `http://localhost:5173/dashboard?payment=success&course=${course_id}&month=${for_month}`;
    
    // If we only have the placeholder key, simulate a dummy sandbox payment success URL
    if (stripeKey === 'sk_test_51Px_placeholder') {
      console.log('⚠️ Using Stripe Sandbox Dummy Mode');
      
      const tempReceipt = `DUMMY-${Date.now().toString().slice(-6)}`;
      const query = `
        INSERT INTO Payments (student_id, course_id, issued_by, amount_paid, payment_method, for_month, receipt_number, payment_status)
        VALUES ($1, $2, NULL, $3, 'Card (Dummy)', $4, $5, 'Completed')
      `;
      await db.pool.query(query, [resolvedStudentId, course_id, amount_paid, for_month, tempReceipt]);
      
      return res.json({ dummy_success: true, message: 'Dummy payment recorded.' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'lkr',
          product_data: { name: `Course Payment: ${for_month}` },
          unit_amount: Math.round(amount_paid * 100), // Stripe expects cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: `http://localhost:5173/dashboard?payment=cancel`,
      metadata: { student_id: resolvedStudentId, course_id, for_month, amount_paid }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Stripe Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.recordPayment = async (req, res) => {
  const { student_id, course_id, amount_paid, payment_method, for_month, receipt_number } = req.body;
  
  // The ID of the Admin/Counter Staff who is logged in
  const issued_by = req.user.userId;

  if (!student_id || !course_id || !amount_paid || !for_month || !receipt_number) {
    return res.status(400).json({ message: "අත්‍යවශ්‍ය සියලුම දත්ත (ශිෂ්‍යයා, පන්තිය, මුදල, මාසය, රසීදු අංකය) ඇතුළත් කරන්න." });
  }

  try {
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
    await auditService.logAction(issued_by, req.user.role, 'CREATE', 'Payment', result.rows[0].payment_id, `Recorded payment of Rs.${amount_paid} for student ${student_id} for ${for_month}.`);
  } catch (error) {
    console.error('❌ Payment Recording Error:', error.message);
    res.status(500).json({ message: "ගෙවීම් සටහන් කිරීම අසාර්ථකයි.", error: error.message });
  }
};

exports.getStudentPayments = async (req, res) => {
  let { studentId } = req.params;
  try {
    if (req.user && req.user.role === 'Student') {
      const studentRes = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentRes.rows.length > 0) {
        studentId = studentRes.rows[0].student_id;
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
        AND ce.enrollment_status = 'Enrolled'
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

  try {
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
  const { status, comments } = req.body; // 'Completed' or 'Rejected'

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
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ⏳ Get Overdue Payments
 */
exports.getOverduePayments = async (req, res) => {
  const { month } = req.query; // e.g. '2026-05'
  
  try {
    const query = `
      SELECT ce.student_id, s.student_name, c.course_name, p.parent_phone
      FROM Course_Enrollments ce
      JOIN Students s ON ce.student_id = s.student_id
      JOIN Parents p ON s.parent_id = p.parent_id
      JOIN Courses c ON ce.course_id = c.course_id
      WHERE ce.enrollment_status = 'Enrolled'
        AND NOT EXISTS (
          SELECT 1 FROM Payments pay
          WHERE pay.student_id = ce.student_id
            AND pay.course_id = ce.course_id
            AND pay.for_month = $1
            AND pay.payment_status = 'Completed'
        )
    `;
    const result = await db.pool.query(query, [month]);
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
  try {
    if (req.user && req.user.role === 'Student') {
      const studentRes = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentRes.rows.length === 0) {
        return res.status(404).json({ message: "ශිෂ්‍යයා සොයාගත නොහැක." });
      }
      resolvedStudentId = studentRes.rows[0].student_id;
    }

    // Check for existing payment
    const existingPayment = await db.pool.query(
      `SELECT * FROM Payments WHERE student_id = $1 AND course_id = $2 AND for_month = $3 AND payment_status IN ('Completed', 'Pending Verification')`,
      [resolvedStudentId, course_id, for_month]
    );
    if (existingPayment.rows.length > 0) {
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
    
    const result = await db.pool.query(query, values);

    res.status(201).json({
      message: 'ගෙවීම් රිසිට් පත සාර්ථකව උඩුගත කරන ලදී. තහවුරු කරන තෙක් රැඳී සිටින්න.',
      payment: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Manual Payment Submission Error:', error.message);
    res.status(500).json({ message: "ගෙවීම ඉදිරිපත් කිරීම අසාර්ථකයි.", error: error.message });
  }
};

/**
 * 🔍 Get All Payments with filters (Course, Month, Search by Student name/QR)
 */
exports.getAllPayments = async (req, res) => {
  const { course_id, for_month, search } = req.query;
  try {
    let query = `
      SELECT p.*, c.course_name, s.student_name, s.qr_code_key, u.username as issued_by_name
      FROM Payments p
      JOIN Courses c ON p.course_id = c.course_id
      JOIN Students s ON p.student_id = s.student_id
      LEFT JOIN Users u ON p.issued_by = u.user_id
      WHERE 1=1
    `;
    const values = [];
    let valIndex = 1;

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