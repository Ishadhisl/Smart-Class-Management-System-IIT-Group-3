const cron = require('node-cron');
const db = require('../db');
const smsService = require('./smsService');
const attendanceController = require('../controllers/attendanceController');

/**
 * Initializes automated tasks for the system.
 */
const initCronJobs = () => {
  // Schedule a job to run on the 5th of every month at 08:00 AM
  // Pattern: minute hour day-of-month month day-of-week
  cron.schedule('0 8 5 * *', async () => {
    console.log('🕒 [Cron] Starting automated monthly late payment reminders...');
    
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

    try {
      const query = `
        SELECT s.student_id, s.student_name, p.parent_phone, c.course_name
        FROM Course_Enrollments ce
        JOIN Students s ON ce.student_id = s.student_id
        JOIN Parents p ON s.parent_id = p.parent_id
        JOIN Courses c ON ce.course_id = c.course_id
        WHERE ce.enrollment_status IN ('Enrolled', 'Active')
          AND NOT EXISTS (
            SELECT 1 FROM Payments pay
            WHERE pay.student_id = ce.student_id
              AND pay.course_id = ce.course_id
              AND pay.for_month = $1
          )
      `;
      const result = await db.pool.query(query, [currentMonth]);

      for (const student of result.rows) {
        await smsService.sendLatePaymentSMS(student.student_id, student.student_name, student.parent_phone, student.course_name, currentMonth);
      }
      console.log(`✅ [Cron] Automated reminders sent to ${result.rows.length} students.`);
    } catch (error) {
      console.error('❌ [Cron] Error running automated reminders:', error);
    }
  });

  /**
   * 🕒 [Cron] Auto-Release Expired Study Area Seats
   * Runs every 5 minutes to check for 4-hour limit expirations.
   */
  cron.schedule('*/5 * * * *', async () => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Find seats that need to be released
      const expiredQuery = `
        UPDATE Study_Seats SET seat_status = 'Available' 
        WHERE seat_id IN (
          SELECT seat_id FROM Study_Area_Bookings 
          WHERE booking_status = 'Confirmed' AND expiry_time < NOW()
        )
      `;
      await client.query(expiredQuery);

      // 2. Mark bookings as completed
      await client.query("UPDATE Study_Area_Bookings SET booking_status = 'Completed' WHERE booking_status = 'Confirmed' AND expiry_time < NOW()");

      // 3. 🚩 NEW: Auto-cancel "Pending" bookings after 15-minute grace period
      const noShowQuery = `
        UPDATE Study_Seats SET seat_status = 'Available'
        WHERE seat_id IN (
          SELECT seat_id FROM Study_Area_Bookings
          WHERE booking_status = 'Pending' 
          AND expected_arrival_time < (NOW() - INTERVAL '15 minutes')
        )
      `;
      await client.query(noShowQuery);
      await client.query("UPDATE Study_Area_Bookings SET booking_status = 'Cancelled' WHERE booking_status = 'Pending' AND expected_arrival_time < (NOW() - INTERVAL '15 minutes')");

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [Cron] Study Area auto-release error:', error);
    } finally {
      client.release();
    }
  });

  /**
   * 🚨 [Cron] Safety Congestion Check
   * Runs every 5 minutes to detect if halls stay over-capacity.
   */
  cron.schedule('*/5 * * * *', async () => {
    console.log('🕒 [Cron] Checking hall congestion status...');
    await attendanceController.processCongestionWarnings();
  });
};

module.exports = { initCronJobs };