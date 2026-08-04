const db = require('../db');
const auditService = require('../utils/auditService');

exports.createBooking = async (req, res) => {
  const { student_id, seat_id, expected_arrival_time } = req.body;
  let final_student_id = student_id;

  try {
    if (req.user?.role === 'Student') {
      // 💡 Resolve the student_id from Students table using logged-in user_id
      const studentLookup = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentLookup.rows.length === 0) {
        return res.status(404).json({ message: "ශිෂ්‍ය ගිණුම සොයාගත නොහැකි විය." });
      }
      final_student_id = studentLookup.rows[0].student_id;
    }

    if (!final_student_id || !seat_id || !expected_arrival_time) {
      return res.status(400).json({ message: "ශිෂ්‍යයා, අසුන සහ පැමිණෙන වේලාව ඇතුළත් කිරීම අනිවාර්ය වේ." });
    }

    // Backend validation: prevent past date/time booking (with 1 minute safety buffer for network latency/server clock offset)
    const selectedTime = new Date(expected_arrival_time);
    const currentTime = new Date();
    if (selectedTime < new Date(currentTime.getTime() - 60000)) {
      return res.status(400).json({ message: "පසුගිය වේලාවන් සඳහා අසුන් වෙන් කළ නොහැක. (Cannot book seats for past date and time.)" });
    }
    // 1. Check if the seat is already booked/occupied
    const seatCheck = await db.pool.query('SELECT seat_status FROM Study_Seats WHERE seat_id = $1', [seat_id]);
    if (seatCheck.rows[0].seat_status !== 'Available') {
      return res.status(400).json({ message: "මෙම අසුන දැනට ලබාගත නොහැක." });
    }

    // 2. Insert booking with 4-hour limit (expiry_time = arrival + 4 hours)
    const query = `
      INSERT INTO Study_Area_Bookings (student_id, seat_id, expected_arrival_time, expiry_time, booking_status)
      VALUES ($1, $2, $3, $3::timestamp + INTERVAL '4 hours', 'Pending')
      RETURNING *
    `;
    const result = await db.pool.query(query, [final_student_id, seat_id, expected_arrival_time]);

    // 3. Update seat status to 'Reserved'
    await db.pool.query('UPDATE Study_Seats SET seat_status = $1 WHERE seat_id = $2', ['Reserved', seat_id]);

    res.status(201).json({
      message: 'අසුන සාර්ථකව වෙන් කරන ලදී (පැය 4ක කාලසීමාවකට).',
      booking: result.rows[0]
    });
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Study_Area_Booking', result.rows[0].booking_id, `Booked seat ${seat_id} for student ${final_student_id}.`);
  } catch (error) {
    console.error('❌ Booking Error:', error.message);
    res.status(500).json({ message: "අසුන වෙන් කිරීම අසාර්ථකයි.", error: error.message });
  }
};

exports.checkIn = async (req, res) => {
  const { bookingId } = req.params;
  try {
    // 15-minute cancellation rule logic check
    const bookingQuery = 'SELECT * FROM Study_Area_Bookings WHERE booking_id = $1';
    const bookingRes = await db.pool.query(bookingQuery, [bookingId]);

    if (bookingRes.rows.length === 0) return res.status(404).json({ message: "Booking not found" });

    const booking = bookingRes.rows[0];

    // 🛡️ Security Check: Students can only check-in their own bookings
    if (req.user?.role === 'Student') {
      const studentLookup = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentLookup.rows.length === 0 || booking.student_id !== studentLookup.rows[0].student_id) {
        return res.status(403).json({ message: "මෙම වෙන් කිරීම වෙනස් කිරීමට ඔබට අවසර නැත." });
      }
    }

    const now = new Date();
    const expected = new Date(booking.expected_arrival_time);
    const diffMinutes = (now - expected) / (1000 * 60);

    if (diffMinutes > 15) {
      await db.pool.query("UPDATE Study_Area_Bookings SET booking_status = 'Cancelled' WHERE booking_id = $1", [bookingId]);
      await db.pool.query("UPDATE Study_Seats SET seat_status = 'Available' WHERE seat_id = $1", [booking.seat_id]);
      await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Study_Area_Booking', bookingId, `Booking ${bookingId} cancelled due to late check-in.`);
      return res.status(400).json({ message: "පැමිණීමට නියමිත වේලාවට වඩා විනාඩි 15ක් පසුවී ඇති බැවින් වෙන් කිරීම අවලංගු කර ඇත." });
    }

    // 💡 Logic Update: 4-hour duration now starts from actual arrival (Check-in)
    await db.pool.query(
      "UPDATE Study_Area_Bookings SET actual_arrival_time = CURRENT_TIMESTAMP, expiry_time = CURRENT_TIMESTAMP + INTERVAL '4 hours', booking_status = 'Confirmed' WHERE booking_id = $1",
      [bookingId]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Study_Area_Booking', bookingId, `Booking ${bookingId} confirmed (checked-in).`);
    await db.pool.query("UPDATE Study_Seats SET seat_status = 'Occupied' WHERE seat_id = $1", [booking.seat_id]);

    res.json({ message: "පැමිණීම සාර්ථකව සටහන් විය. අධ්‍යයන කටයුතු ආරම්භ කළ හැක." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkOut = async (req, res) => {
  const { bookingId } = req.params;
  const { seat_id } = req.body; // Seat ID is needed to update seat status

  if (!bookingId || !seat_id) {
    return res.status(400).json({ message: "Booking ID සහ Seat ID අත්‍යවශ්‍ය වේ." });
  }

  try {
    const bookingQuery = 'SELECT student_id FROM Study_Area_Bookings WHERE booking_id = $1';
    const bookingRes = await db.pool.query(bookingQuery, [bookingId]);
    if (bookingRes.rows.length > 0) {
      const booking = bookingRes.rows[0];
      // 🛡️ Security Check: Students can only check-out their own bookings
      if (req.user?.role === 'Student') {
        const studentLookup = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
        if (studentLookup.rows.length === 0 || booking.student_id !== studentLookup.rows[0].student_id) {
          return res.status(403).json({ message: "මෙම වෙන් කිරීම වෙනස් කිරීමට ඔබට අවසර නැත." });
        }
      }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Update booking status to 'Completed'
      await client.query(
        "UPDATE Study_Area_Bookings SET booking_status = 'Completed', actual_end_time = CURRENT_TIMESTAMP WHERE booking_id = $1",
        [bookingId]
      );
      // Update seat status to 'Available'
      await client.query("UPDATE Study_Seats SET seat_status = 'Available' WHERE seat_id = $1", [seat_id]);

      await client.query('COMMIT');
      await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Study_Area_Booking', bookingId, `Checked out seat ${seat_id}.`);
      res.json({ message: "අසුන සාර්ථකව නිදහස් කරන ලදී." });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } catch (error) {
    console.error('❌ Check-out Error:', error.message);
    res.status(500).json({ error: 'අසුන නිදහස් කිරීම අසාර්ථකයි.' });
  }
};

exports.getAvailableSeats = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.seat_id, s.seat_id as seat_number, s.seat_status as status,
        b.booking_id as current_booking_id,
        b.expected_arrival_time
      FROM Study_Seats s
      LEFT JOIN Study_Area_Bookings b ON s.seat_id = b.seat_id AND b.booking_status IN ('Pending', 'Confirmed')
      ORDER BY s.seat_id
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ℹ️ Get Booking Status
 */
exports.getBookingStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query('SELECT * FROM Study_Area_Bookings WHERE booking_id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Booking not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * 📜 Get Student Booking History
 */
exports.getStudentHistory = async (req, res) => {
  let { studentId } = req.params;
  try {
    if (req.user?.role === 'Student') {
      // 💡 Resolve studentId for history lookup
      const studentLookup = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentLookup.rows.length === 0) {
        return res.status(404).json({ message: "ශිෂ්‍ය ගිණුම සොයාගත නොහැකි විය." });
      }
      studentId = studentLookup.rows[0].student_id;
    }
    const result = await db.pool.query('SELECT * FROM Study_Area_Bookings WHERE student_id = $1 ORDER BY created_at DESC', [studentId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};