const db = require('../db');
const path = require('node:path');
const smsService = require('../utils/smsService');
const auditService = require('../utils/auditService');
const axios = require('axios'); // Added axios for microservice calls

/**
 * 💡 Helper: Executes the AI Python microservice via HTTP
 */
async function runAIProcess(mode, inputData) {
  try {
    const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
    if (mode === 'status') {
      const response = await axios.get(`${FASTAPI_URL}/status`);
      return response.data;
    }
    const response = await axios.post(`${FASTAPI_URL}/${mode}`, inputData);
    if (response.data.error && !response.data.fallback_active) {
       throw new Error(response.data.error);
    }
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error(`AI Microservice Error: ${error.message}`);
  }
}

exports.runAIProcess = runAIProcess;

/**
 * 🛡️ Industrial Logic: Handles QR code scanning and triggers automatic SMS.
 */
exports.markAttendanceByQR = async (req, res) => {
  const { qr_code_key, course_id } = req.body;

  if (!qr_code_key || !course_id) {
    return res.status(400).json({ message: "QR Key සහ Course ID අත්‍යවශ්‍ය වේ." });
  }

  try {
    // 1. ශිෂ්‍යයා සොයා ගැනීම
    const studentRes = await db.pool.query('SELECT student_id, student_name FROM Students WHERE qr_code_key = $1', [qr_code_key]);
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ message: "ශිෂ්‍යයා හමුවුනේ නැත." });
    }
    const student = studentRes.rows[0];

    // 2. පන්තිය සොයා ගැනීම (day_of_week array format support)
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const courseRes = await db.pool.query(
      `SELECT c.course_name, cs.start_time, cs.schedule_id 
       FROM Courses c 
       JOIN Class_Schedules cs ON c.course_id = cs.course_id 
       WHERE c.course_id = $1 
         AND (
           cs.day_of_week = $2 
           OR cs.day_of_week = '{"' || $2 || '"}'
           OR cs.day_of_week::text ILIKE '%' || $2 || '%'
         )`, 
      [course_id, dayOfWeek]
    );
    const course = courseRes.rows[0];
    const courseName = course?.course_name || "General Class";
    const startTime = course?.start_time;
    const session_id = course?.schedule_id; // Correct session_id for AI tracking

    // 💡 Industrial Logic: Determine if student is 'Late' (15 min threshold)
    let attendanceStatus = 'Present';
    if (startTime) {
      const now = new Date();
      const [hours, minutes] = startTime.split(':').map(Number);
      const classStartToday = new Date();
      classStartToday.setHours(hours, minutes, 0, 0);

      // Fetching the late threshold dynamically (defaulting to 15 if not set)
      const settingsRes = await db.pool.query("SELECT setting_value FROM System_Settings WHERE setting_key = 'late_threshold_minutes'");
      const thresholdMinutes = settingsRes.rows[0]?.setting_value ? Number.parseInt(settingsRes.rows[0].setting_value, 10) : 15;

      const lateThreshold = new Date(classStartToday.getTime() + thresholdMinutes * 60 * 1000); 
      if (now > lateThreshold) {
        attendanceStatus = 'Late';
      }
    }

    // 3. දැනටමත් පැමිණීම සටහන් කර ඇත්දැයි බැලීම (Duplicate Prevention)
    const checkQuery = `
      SELECT 1 FROM Student_Attendance_Logs 
      WHERE student_id = $1 AND course_id = $2 AND DATE(scanned_at) = CURRENT_DATE
    `;
    const existing = await db.pool.query(checkQuery, [student.student_id, course_id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "අද දින සඳහා පැමිණීම දැනටමත් සටහන් කර ඇත." });
    }

    // 4. පැමිණීම සටහන් කිරීම
    const recordQuery = `
      INSERT INTO Student_Attendance_Logs (student_id, course_id, session_id, attendance_status, scanned_at)
      VALUES ($1, $2, $3, $4, NOW()) RETURNING scanned_at
    `;
    const result = await db.pool.query(recordQuery, [student.student_id, course_id, session_id, attendanceStatus]);
    const scannedAt = result.rows[0].scanned_at;
    const timeString = new Date(scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 5. ස්වයංක්‍රීයව SMS යැවීම
    await smsService.sendAttendanceSMS(student.student_id, courseName, timeString, attendanceStatus);

    res.status(201).json({ message: `පැමිණීම (${attendanceStatus === 'Late' ? 'ප්‍රමාද' : 'පැමිණි'}) ලෙස සටහන් වූ අතර මව්පියන්ට SMS පණිවිඩයක් යවන ලදී.`, student_name: student.student_name });
  } catch (error) {
    console.error('❌ QR Attendance Error:', error.message);
    res.status(500).json({ error: 'පැමිණීම සටහන් කිරීම අසාර්ථකයි.' });
  }
};

/**
 * 🛡️ Zoned Validation Logic (The "1,000 Student Solution")
 * Aggregates headcount from multiple zone cameras and compares to QR data.
 */
exports.validateAttendanceWithZones = async (req, res) => {
  const { session_id, hall_id } = req.body;

  if (!session_id || !hall_id) {
    return res.status(400).json({ message: "Session ID සහ Hall ID අත්‍යවශ්‍ය වේ." });
  }

  try {
    // 1. Get all camera zones for this hall (Front, Middle, Back)
    const zonesRes = await db.pool.query(
      'SELECT * FROM Camera_Zones WHERE hall_id = $1 ORDER BY position ASC',
      [hall_id]
    );
    const zones = zonesRes.rows;

    if (zones.length === 0) {
      return res.status(404).json({ message: "මෙම ශාලාව සඳහා කැමරා කලාප (Zones) සකසා නැත." });
    }

    // 2. Pass 1: Headcount (Fast YOLO Count)
    const headcountResult = await runAIProcess('headcount', { zones });
    const zoneResults = headcountResult.zone_breakdown;
    const totalAIHeadcount = headcountResult.total_ai_headcount;

    // 3. Get actual QR scan count from door logs for the specific session
    const qrCountRes = await db.pool.query(
      `SELECT COUNT(DISTINCT student_id) FROM Student_Attendance_Logs 
       WHERE course_id = (SELECT course_id FROM Class_Schedules WHERE schedule_id = $1) 
       AND DATE(scanned_at) = CURRENT_DATE`,
      [session_id]
    );
    const qrCount = Number.parseInt(qrCountRes.rows[0].count, 10);

    // 💡 Fetching the AI mismatch threshold dynamically (defaulting to 0 if not set in System_Settings)
    const settingsRes = await db.pool.query("SELECT setting_value FROM System_Settings WHERE setting_key = 'ai_mismatch_threshold'");
    const aiThreshold = settingsRes.rows[0]?.setting_value ? Number.parseInt(settingsRes.rows[0].setting_value, 10) : 0;

    // 4. Mismatch Detection (Triggered if difference > dynamic threshold)
    const mismatchDetected = Math.abs(totalAIHeadcount - qrCount) > aiThreshold;

    let verificationData = null;
    const studentsRes = await db.pool.query(
      `SELECT s.student_id, s.student_name 
       FROM Students s
       JOIN Student_Attendance_Logs sal ON s.student_id = sal.student_id
       WHERE sal.session_id = $1
       AND sal.is_face_verified = FALSE
       AND DATE(sal.scanned_at) = CURRENT_DATE`,
      [session_id]
    );

    const zoneDetailsObj = {};
    zones.forEach(z => {
      zoneDetailsObj[z.zone_name] = zoneResults[z.zone_name] || 0;
    });

    verificationData = {
      unverified_students: studentsRes.rows.map(s => ({ id: s.student_id, name: s.student_name })),
      zone_details: zoneDetailsObj,
      image_paths: {}
    };

    // 5. Update Master Record with JSON breakdown
    const masterQuery = `
      INSERT INTO Attendance_Master (session_id, qr_count, ai_headcount, zone_details, mismatch_detected, verification_data, validated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (session_id) 
      DO UPDATE SET qr_count = $2, ai_headcount = $3, zone_details = $4, mismatch_detected = $5, verification_data = $6, validated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    await db.pool.query(masterQuery, [session_id, qrCount, totalAIHeadcount, JSON.stringify(zoneResults), mismatchDetected, JSON.stringify(verificationData)]);

    // 📋 Log Discrepancy for Audit if mismatch detected
    if (mismatchDetected) {
      await auditService.logAction(req.user?.userId, req.user?.role, 'ALERT', 'Attendance', session_id, `Attendance mismatch: QR ${qrCount} vs AI ${totalAIHeadcount}`);

      // 🛡️ record detailed entry in Suspicious Activity Log
      const suspiciousQuery = `
        INSERT INTO Suspicious_Attendance_Logs (session_id, qr_count, ai_headcount, zone_details, unverified_student_ids, image_paths, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
      `;
      const unverifiedIds = verificationData?.unverified_students?.map(s => s.id) || [];
      await db.pool.query(suspiciousQuery, [session_id, qrCount, totalAIHeadcount, JSON.stringify(zoneResults), JSON.stringify(unverifiedIds), JSON.stringify(verificationData?.image_paths || {})]);
    }

    res.status(200).json({
      message: mismatchDetected ? '⚠️ විසංවාදයක් (Mismatch) හමුවිය!' : '✅ පැමිණීම තහවුරුයි.',
      data: {
        qr_count: qrCount, ai_headcount: totalAIHeadcount,
        mismatch_detected: mismatchDetected, zone_breakdown: zoneResults, verification_data: verificationData
      }
    });

  } catch (error) {
    console.error('❌ Zoned Attendance Error:', error.message);
    res.status(500).json({ error: 'කලාපීය පැමිණීම පරීක්ෂා කිරීම අසාර්ථකයි.' });
  }
};

/**
 * 🛡️ Retrieves historical discrepancy logs for Admin review.
 */
exports.getSuspiciousLogs = async (req, res) => {
  const { startDate, endDate } = req.query;
  let query = `
    SELECT sl.*, c.course_name as class_name 
    FROM Suspicious_Attendance_Logs sl 
    JOIN Class_Schedules cs ON sl.session_id = cs.schedule_id
    JOIN Courses c ON cs.course_id = c.course_id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    params.push(startDate);
    query += ` AND sl.detected_at >= $${params.length}::date`;
  }
  if (endDate) {
    params.push(endDate);
    query += ` AND sl.detected_at <= $${params.length}::date + INTERVAL '1 day'`;
  }

  query += ` ORDER BY sl.detected_at DESC`;

  try {
    const result = await db.pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Suspicious logs retrieval error:', err);
    res.status(500).json({ error: 'විසංවාද වාර්තා ලබා ගැනීමට නොහැකි විය.' });
  }
};

/**
 * 🛠️ Bulk resolves discrepancy logs (System Audit helper).
 */
exports.bulkResolveLogs = async (req, res) => {
  const { logIds, comment } = req.body;
  if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
    return res.status(400).json({ message: "නිරාකරණය කිරීමට වාර්තා තෝරා නොමැත." });
  }

  try {
    await db.pool.query(
      "UPDATE Suspicious_Attendance_Logs SET status = 'Resolved', resolution_comment = $1 WHERE log_id = ANY($2)",
      [comment || 'Resolved via System Audit', logIds]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Suspicious_Log', null, `Bulk resolved ${logIds.length} logs.`);
    res.json({ message: `වාර්තා ${logIds.length} ක් සාර්ථකව නිරාකරණය කළා!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✅ Resolves a discrepancy log with Admin comments.
 */
exports.resolveLog = async (req, res) => {
  const { logId } = req.params;
  const { comment } = req.body;
  try {
    await db.pool.query(
      "UPDATE Suspicious_Attendance_Logs SET status = 'Resolved', resolution_comment = $1 WHERE log_id = $2",
      [comment, logId]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Suspicious_Log', logId, 'Resolved discrepancy.');
    res.json({ message: "විසංවාදය සාර්ථකව නිරාකරණය කළා!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * 📊 Get Study Area Occupancy per Hour for HomeTab.
 */
exports.getLibraryOccupancyStats = async (req, res) => {
  try {
    const query = `
      SELECT TO_CHAR(actual_arrival_time, 'HH24:00') AS hour, COUNT(*) AS count
      FROM Study_Area_Bookings
      WHERE actual_arrival_time >= CURRENT_DATE
      GROUP BY hour ORDER BY hour;
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

/**
 * 🔔 Sends an SMS alert to parents when a face verification discrepancy is found.
 */
exports.sendDiscrepancyAlert = async (req, res) => {
  const { student_id, session_id } = req.body;

  if (!student_id || !session_id) {
    return res.status(400).json({ message: "Student ID සහ Session ID අත්‍යවශ්‍ය වේ." });
  }

  try {
    const query = `
      SELECT s.student_name, p.parent_phone, c.course_name 
      FROM Students s 
      JOIN Parents p ON s.parent_id = p.parent_id 
      JOIN Course_Enrollments ce ON s.student_id = ce.student_id
      JOIN Courses c ON ce.course_id = c.course_id
      JOIN Class_Schedules cs ON c.course_id = cs.course_id
      WHERE s.student_id = $1 AND cs.schedule_id = $2
      LIMIT 1
    `;
    const result = await db.pool.query(query, [student_id, session_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "ශිෂ්‍යයාගේ හෝ පන්තියේ විස්තර සොයාගත නොහැකි විය." });
    }

    const { student_name, parent_phone, course_name } = result.rows[0];

    // We assume smsService.sendDiscrepancySMS is implemented in your smsService utility
    await smsService.sendDiscrepancySMS(parent_phone, student_name, course_name);

    res.status(200).json({ message: "මව්පියන්ට සාර්ථකව දැනුම් දෙන ලදී." });
  } catch (error) {
    console.error('❌ Discrepancy SMS Error:', error.message);
    res.status(500).json({ error: 'SMS යැවීම අසාර්ථකයි.' });
  }
};

/**
 * 🔔 Sends bulk SMS alerts to parents when multiple discrepancies are found.
 */
exports.bulkSendDiscrepancyAlerts = async (req, res) => {
  const { student_ids, session_id } = req.body;

  if (!student_ids || !Array.isArray(student_ids) || !session_id) {
    return res.status(400).json({ message: "Student IDs ලැයිස්තුව සහ Session ID අත්‍යවශ්‍ය වේ." });
  }

  try {
    const query = `
      SELECT s.student_id, s.student_name, p.parent_phone, c.course_name 
      FROM Students s 
      JOIN Parents p ON s.parent_id = p.parent_id 
      JOIN Course_Enrollments ce ON s.student_id = ce.student_id
      JOIN Courses c ON ce.course_id = c.course_id
      JOIN Class_Schedules cs ON c.course_id = cs.course_id
      WHERE s.student_id = ANY($1) AND cs.schedule_id = $2
    `;
    const result = await db.pool.query(query, [student_ids, session_id]);

    let sentCount = 0;
    for (const row of result.rows) {
      // Note: In production, consider using a queue for massive numbers of SMS
      await smsService.sendDiscrepancySMS(row.parent_phone, row.student_name, row.course_name);
      sentCount++;
    }

    res.status(200).json({ message: `${sentCount} දෙනෙකුගේ මව්පියන්ට සාර්ථකව දැනුම් දෙන ලදී.` });
  } catch (error) {
    console.error('❌ Bulk Discrepancy SMS Error:', error.message);
    res.status(500).json({ error: 'Bulk SMS යැවීම අසාර්ථකයි.' });
  }
};

/**
 * 📊 Get Total Suspicious Incidents for HomeTab.
 */
exports.getTotalSuspiciousIncidents = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved
      FROM Suspicious_Attendance_Logs;
    `;
    const result = await db.pool.query(query);
    res.json({ 
      pending: Number(result.rows[0].pending), 
      resolved: Number(result.rows[0].resolved) 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

/**
 * 🌡️ Get Real-time Hall Occupancy for Heat Map.
 * Aggregates student arrivals per hall per hour.
 */
exports.getHallOccupancyStats = async (req, res) => {
  try {
    const query = `
      SELECT 
        h.hall_name, 
        TO_CHAR(sal.scanned_at, 'HH24:00') AS hour, 
        COUNT(*) AS count
      FROM Student_Attendance_Logs sal
      JOIN Class_Schedules cs ON sal.course_id = cs.course_id
      JOIN Halls h ON cs.hall_id = h.hall_id
      WHERE DATE(sal.scanned_at) = CURRENT_DATE
      GROUP BY h.hall_name, hour
      ORDER BY h.hall_name, hour;
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

/**
 * 🚨 Get Currently Active Congestions.
 * Returns halls that are currently being tracked for over-capacity.
 */
exports.getActiveCongestions = async (req, res) => {
  try {
    const query = `
      SELECT h.hall_name, (EXTRACT(EPOCH FROM (NOW() - ct.first_detected_at))/60)::INT as minutes_congested
      FROM Hall_Congestion_Tracker ct
      JOIN Halls h ON ct.hall_id = h.hall_id
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

/**
 * 🔔 Hall Safety Drill Mode.
 * Sends a test SMS to all registered staff phone numbers.
 */
exports.triggerSafetyDrill = async (req, res) => {
  try {
    const settingsRes = await db.pool.query("SELECT setting_value FROM System_Settings WHERE setting_key = 'safety_staff_phones'");
    const staffPhones = (settingsRes.rows[0]?.setting_value || '').split(',');

    const message = "🧪 [SAFETY DRILL] This is a test alert from the Thusitha Smart Class Congestion Monitoring System. Please acknowledge receipt.";
    
    for (const phone of staffPhones) {
      if (phone.trim()) await smsService.sendCustomSMS(phone.trim(), message);
    }

    res.json({ message: "Safety Drill සාර්ථකව ආරම්භ කළා! සියලුම කාර්ය මණ්ඩලයට SMS පණිවිඩ යවන ලදී." });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

/**
 * Helper: Handle over-capacity hall congestion
 */
const handleOverCapacityHall = async (hall, tracker, thresholdMinutes, staffPhones) => {
  if (tracker.rows.length === 0) {
    // First time detecting over-capacity
    await db.pool.query('INSERT INTO Hall_Congestion_Tracker (hall_id, first_detected_at) VALUES ($1, NOW())', [hall.hall_id]);
  } else {
    const { first_detected_at, sms_sent } = tracker.rows[0];
    const diffMinutes = (Date.now() - new Date(first_detected_at).getTime()) / (1000 * 60);

    if (diffMinutes >= thresholdMinutes && !sms_sent) {
      await notifyStaffOfCongestion(hall, thresholdMinutes, staffPhones, first_detected_at);
    }
  }
};

/**
 * Helper: Send congestion notifications to staff
 */
const notifyStaffOfCongestion = async (hall, thresholdMinutes, staffPhones, firstDetectedAt) => {
  console.log(`🚨 [Alert] Hall ${hall.hall_name} is congested! Sending SMS to staff.`);
  
  const message = `🚨 CONGESTION ALERT: Hall ${hall.hall_name} has ${hall.current_count} students (Capacity: ${hall.capacity}). Over-capacity for ${thresholdMinutes}+ minutes.`;
  
  for (const phone of staffPhones) {
    await smsService.sendCustomSMS(phone.trim(), message); 
  }

  const logRes = await db.pool.query(
    'INSERT INTO Hall_Congestion_Logs (hall_id, peak_count, capacity, started_at) VALUES ($1, $2, $3, $4) RETURNING log_id',
    [hall.hall_id, hall.current_count, hall.capacity, firstDetectedAt]
  );
  
  await db.pool.query('UPDATE Hall_Congestion_Tracker SET sms_sent = TRUE, active_log_id = $1 WHERE hall_id = $2', [logRes.rows[0].log_id, hall.hall_id]);
};

/**
 * Helper: Handle safe capacity hall
 */
const handleSafeCapacityHall = async (hallId) => {
  const tracker = await db.pool.query('SELECT active_log_id FROM Hall_Congestion_Tracker WHERE hall_id = $1', [hallId]);
  if (tracker.rows[0]?.active_log_id) {
    await db.pool.query(
      'UPDATE Hall_Congestion_Logs SET ended_at = NOW(), duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at))/60 WHERE log_id = $1',
      [tracker.rows[0].active_log_id]
    );
  }
  await db.pool.query('DELETE FROM Hall_Congestion_Tracker WHERE hall_id = $1', [hallId]);
};

/**
 * 🚨 Automated Safety Check: Detects and notifies staff of hall congestion.
 * Triggers if a hall is over-capacity for more than 30 minutes.
 */
exports.processCongestionWarnings = async () => {
  try {
    // 1. Get current occupancy and capacity for all halls with active classes
    const statusQuery = `
      SELECT h.hall_id, h.hall_name, h.capacity, COUNT(sal.log_id) as current_count
      FROM Halls h
      JOIN Class_Schedules cs ON h.hall_id = cs.hall_id
      JOIN Student_Attendance_Logs sal ON cs.course_id = sal.course_id
      WHERE DATE(sal.scanned_at) = CURRENT_DATE
        AND CURRENT_TIME BETWEEN cs.start_time AND cs.end_time
      GROUP BY h.hall_id, h.hall_name, h.capacity;
    `;
    const { rows } = await db.pool.query(statusQuery);

    // 💡 Fetch dynamic safety thresholds and contact info
    const settingsRes = await db.pool.query("SELECT setting_key, setting_value FROM System_Settings WHERE setting_key IN ('safety_congestion_threshold', 'safety_staff_phones')");
    const settingsMap = Object.fromEntries(settingsRes.rows.map(s => [s.setting_key, s.setting_value]));
    const thresholdMinutes = Number.parseInt(settingsMap.safety_congestion_threshold || '30', 10);
    const staffPhones = (settingsMap.safety_staff_phones || '0771234567').split(',');

    for (const hall of rows) {
      const isOverCapacity = hall.current_count > hall.capacity;

      if (isOverCapacity) {
        const tracker = await db.pool.query('SELECT * FROM Hall_Congestion_Tracker WHERE hall_id = $1', [hall.hall_id]);
        await handleOverCapacityHall(hall, tracker, thresholdMinutes, staffPhones);
      } else {
        await handleSafeCapacityHall(hall.hall_id);
      }
    }
  } catch (error) {
    console.error('❌ Congestion processing error:', error.message);
  }
};

/**
 * 🔮 Get Predictive Library Occupancy based on historical averages.
 */
exports.getPredictiveOccupancy = async (req, res) => {
  try {
    const query = `
      SELECT hour, ROUND(AVG(cnt)) AS predicted_count
      FROM (
        SELECT TO_CHAR(actual_arrival_time, 'HH24:00') AS hour, COUNT(*) AS cnt, actual_arrival_time::date AS d
        FROM Study_Area_Bookings
        WHERE actual_arrival_time IS NOT NULL
        GROUP BY d, hour
      ) sub
      GROUP BY hour ORDER BY hour;
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateAIHeadcount = async (req, res) => {
  const { session_id, ai_headcount } = req.body;

  if (!session_id || ai_headcount === undefined) {
    return res.status(400).json({ message: "Session ID සහ Headcount අත්‍යවශ්‍ය වේ." });
  }

  try {
    // 1. Get the current QR scan count from the logs
    const qrCountRes = await db.pool.query(
      'SELECT COUNT(*) FROM Student_Attendance_Logs WHERE attendance_master_id IN (SELECT attendance_master_id FROM Attendance_Master WHERE session_id = $1)',
      [session_id]
    );
    const qrCount = Number.parseInt(qrCountRes.rows[0].count, 10);

    // 2. Check for mismatch (Threshold logic)
    // If AI headcount is higher than QR count, someone might be attending without scanning (Proxy)
    const mismatchDetected = ai_headcount > qrCount;

    // 3. Update or Insert into Attendance_Master
    const query = `
      INSERT INTO Attendance_Master (session_id, qr_count, ai_headcount, mismatch_detected, validated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (session_id) 
      DO UPDATE SET qr_count = $2, ai_headcount = $3, mismatch_detected = $4, validated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await db.pool.query(query, [session_id, qrCount, ai_headcount, mismatchDetected]);

    res.status(200).json({
      message: 'AI Headcount updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ AI Attendance Error:', error.message);
    res.status(500).json({ error: 'AI දත්ත යාවත්කාලීන කිරීම අසාර්ථකයි.' });
  }
};

exports.getAttendanceMaster = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await db.pool.query('SELECT * FROM Attendance_Master WHERE session_id = $1', [sessionId]);
    res.status(200).json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📊 Get Overall AI Validation Success Rate for Dashboard.
 */
exports.getAIHealthStats = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE mismatch_detected = FALSE) as success_count,
        COUNT(*) FILTER (WHERE mismatch_detected = TRUE) as mismatch_count
      FROM Attendance_Master
    `;
    const statsRes = await db.pool.query(query);
    let aiStatus;
    try {
      aiStatus = await runAIProcess('status', {});
    } catch (aiErr) {
      aiStatus = {
        yolo_loaded: false,
        face_rec_enabled: false,
        device: 'Unavailable',
        error: aiErr.message || 'AI engine is offline'
      };
    }
    const stats = statsRes.rows[0];
    
    const successRate = stats.total_sessions > 0 
      ? (Number(stats.success_count) / Number(stats.total_sessions) * 100).toFixed(1) 
      : 100;

    res.json({
      total_sessions: Number(stats.total_sessions),
      success_count: Number(stats.success_count),
      mismatch_count: Number(stats.mismatch_count),
      success_rate: successRate,
      engine_status: aiStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// -------------------------------------------------------------
// NEW MISSING ENDPOINTS ADDED IN PHASE 1
// -------------------------------------------------------------

/**
 * 📷 Trigger CCTV Occupancy Check (Stand-alone endpoint for /headcount)
 */
exports.checkCCTVOccupancy = async (req, res) => {
  const { hall_id } = req.body;
  if (!hall_id) return res.status(400).json({ message: "hall_id අත්‍යවශ්‍ය වේ." });
  
  try {
    const zonesRes = await db.pool.query('SELECT * FROM Camera_Zones WHERE hall_id = $1 ORDER BY position ASC', [hall_id]);
    if (zonesRes.rows.length === 0) return res.status(404).json({ message: "මෙම ශාලාව සඳහා කැමරා කලාප (Zones) සකසා නැත." });
    
    // Call AI process directly for just headcount
    const headcountResult = await runAIProcess('headcount', { zones: zonesRes.rows });
    res.status(200).json({ message: "CCTV Occupancy සාර්ථකයි", data: headcountResult });
  } catch (err) {
    console.error('❌ CCTV Occupancy Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * 🕒 Get Specific Session Attendance
 */
exports.getSessionAttendance = async (req, res) => {
  const { id } = req.params;
  try {
    const masterRes = await db.pool.query('SELECT * FROM Attendance_Master WHERE session_id = $1', [id]);
    const logsRes = await db.pool.query('SELECT sal.*, s.student_name FROM Student_Attendance_Logs sal JOIN Students s ON sal.student_id = s.student_id WHERE course_id = (SELECT course_id FROM Class_Schedules WHERE schedule_id = $1) AND DATE(scanned_at) = CURRENT_DATE', [id]);
    
    res.status(200).json({
      master_record: masterRes.rows[0] || null,
      student_logs: logsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * 📅 Get Daily Attendance Reports
 */
exports.getDailyReports = async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const query = `
      SELECT h.hall_name, c.course_name, COUNT(sal.log_id) as present_count
      FROM Student_Attendance_Logs sal
      JOIN Courses c ON sal.course_id = c.course_id
      JOIN Class_Schedules cs ON c.course_id = cs.course_id
      JOIN Halls h ON cs.hall_id = h.hall_id
      WHERE DATE(sal.scanned_at) = $1
      GROUP BY h.hall_name, c.course_name
    `;
    const result = await db.pool.query(query, [date]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * 📆 Get Monthly Attendance Reports
 */
exports.getMonthlyReports = async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const month = req.query.month || (new Date().getMonth() + 1);
  try {
    const query = `
      SELECT DATE(scanned_at) as date, COUNT(log_id) as daily_total
      FROM Student_Attendance_Logs
      WHERE EXTRACT(YEAR FROM scanned_at) = $1 AND EXTRACT(MONTH FROM scanned_at) = $2
      GROUP BY DATE(scanned_at)
      ORDER BY DATE(scanned_at)
    `;
    const result = await db.pool.query(query, [year, month]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ✏️ Manual Attendance Correction
 */
exports.manualCorrection = async (req, res) => {
  const { logId } = req.params;
  const { attendance_status, reason } = req.body;
  
  if (!attendance_status) return res.status(400).json({ message: "attendance_status අවශ්‍ය වේ." });
  
  try {
    await db.pool.query('UPDATE Student_Attendance_Logs SET attendance_status = $1 WHERE log_id = $2', [attendance_status, logId]);
    await auditService.logAction(req.user?.userId, req.user?.role, 'UPDATE', 'Attendance_Log', logId, `Manual correction to ${attendance_status}. Reason: ${reason || 'Not provided'}`);
    res.status(200).json({ message: "පැමිණීම සාර්ථකව වෙනස් කරන ලදී." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * 🟢 Lightweight Polling Endpoint for SmartAttendanceLivePanel
 * Real-time QR count is fetched directly from Student_Attendance_Logs,
 * joined via attendance_sessions so we handle both session_id systems.
 */
exports.getLiveStatus = async (req, res) => {
  const { id } = req.params; // id = Class_Schedules.schedule_id (used by Attendance_Master)
  try {
    // 1. Get ai_headcount from Attendance_Master (set by CCTV upload)
    const masterResult = await db.pool.query(
      'SELECT ai_headcount, zone_details FROM Attendance_Master WHERE session_id = $1', 
      [id]
    );
    
    // 2. Get the course_id from Class_Schedules using this schedule_id
    const scheduleRes = await db.pool.query(
      'SELECT course_id FROM Class_Schedules WHERE schedule_id = $1',
      [id]
    );
    const courseId = scheduleRes.rows[0]?.course_id;

    let liveQRCount = 0;
    if (courseId) {
      // 3. Get REAL-TIME QR count: count students who scanned today for this course
      //    via attendance_sessions (QR system) linked to Student_Attendance_Logs
      const qrCountRes = await db.pool.query(
        `SELECT COUNT(DISTINCT sal.student_id) as count 
         FROM Student_Attendance_Logs sal
         JOIN attendance_sessions asess ON sal.session_id = asess.session_id
         WHERE asess.course_id = $1 
           AND sal.scanned_at::date = CURRENT_DATE`,
        [courseId]
      );
      liveQRCount = parseInt(qrCountRes.rows[0]?.count || '0', 10);
    }

    // 4. Get dynamic threshold
    const settingsRes = await db.pool.query("SELECT setting_value FROM System_Settings WHERE setting_key = 'ai_mismatch_threshold'");
    const aiThreshold = settingsRes.rows[0]?.setting_value ? Number.parseInt(settingsRes.rows[0].setting_value, 10) : 0;

    if (masterResult.rows.length === 0) {
      // No CCTV upload yet - still show real QR count
      const mismatch = false; // No AI headcount yet to compare
      return res.status(200).json({
        qr_count: liveQRCount, ai_headcount: 0, mismatch_detected: mismatch, zone_breakdown: {}, threshold: aiThreshold
      });
    }

    const data = masterResult.rows[0];
    const aiHeadcount = data.ai_headcount || 0;

    // 4. Calculate mismatch live using real QR count
    const mismatchDetected = aiHeadcount > liveQRCount;

    // Also update Attendance_Master with latest real QR count
    await db.pool.query(
      'UPDATE Attendance_Master SET qr_count = $1, mismatch_detected = $2 WHERE session_id = $3',
      [liveQRCount, mismatchDetected, id]
    );
    
    // Parse zone_details safely
    let parsedZones = {};
    if (data.zone_details) {
      try {
        parsedZones = typeof data.zone_details === 'string' ? JSON.parse(data.zone_details) : data.zone_details;
      } catch (e) {
        parsedZones = {};
      }
    }

    res.status(200).json({
      qr_count: liveQRCount,
      ai_headcount: aiHeadcount,
      mismatch_detected: mismatchDetected,
      zone_breakdown: parsedZones,
      threshold: aiThreshold
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * 💾 Bulk Save Manual Attendance
 */
exports.saveManualAttendance = async (req, res) => {
  const { course_id, records } = req.body;
  if (!course_id || !records || !Array.isArray(records)) {
    return res.status(400).json({ message: "Course ID සහ පැමිණීම් වාර්තා අවශ්‍ය වේ." });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (const record of records) {
      const studentId = record.student;
      const status = record.status; // 'Present' or 'Absent'

      // Check if student exists
      const studentRes = await client.query('SELECT 1 FROM Students WHERE student_id = $1', [studentId]);
      if (studentRes.rows.length === 0) continue;

      if (status === 'Present') {
        // Check if attendance already logged for today
        const checkRes = await client.query(
          'SELECT 1 FROM Student_Attendance_Logs WHERE student_id = $1 AND course_id = $2 AND DATE(scanned_at) = CURRENT_DATE',
          [studentId, course_id]
        );
        if (checkRes.rows.length === 0) {
          await client.query(
            'INSERT INTO Student_Attendance_Logs (student_id, course_id, attendance_status, scanned_at) VALUES ($1, $2, $3, NOW())',
            [studentId, course_id, 'Present']
          );
        }
      } else {
        // If status is Absent, delete any log for today
        await client.query(
          'DELETE FROM Student_Attendance_Logs WHERE student_id = $1 AND course_id = $2 AND DATE(scanned_at) = CURRENT_DATE',
          [studentId, course_id]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: "පැමිණීම සාර්ථකව සුරැකුණි!" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Save Manual Attendance Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * 📅 Get Today's Student Attendance Logs by Course ID
 */
exports.getTodayLogsByCourse = async (req, res) => {
  const { courseId } = req.params;
  const { all } = req.query;
  try {
    let query;
    if (all === 'true') {
      query = `
        SELECT l.log_id, l.student_id, s.student_name, s.qr_code_key, l.attendance_status, l.scanned_at,
               l.is_face_verified, l.face_verified_at
        FROM Student_Attendance_Logs l
        JOIN Students s ON l.student_id = s.student_id
        WHERE l.course_id = $1
        ORDER BY l.scanned_at DESC
      `;
    } else {
      query = `
        SELECT l.log_id, l.student_id, s.student_name, l.attendance_status, l.scanned_at,
               l.is_face_verified, l.face_verified_at
        FROM Student_Attendance_Logs l
        JOIN Students s ON l.student_id = s.student_id
        WHERE l.course_id = $1 AND DATE(l.scanned_at) = CURRENT_DATE
        ORDER BY l.scanned_at DESC
      `;
    }
    const result = await db.pool.query(query, [courseId]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Get Logs Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * 📊 Get Today's Attendance Master by Course ID
 */
exports.getTodayMasterByCourse = async (req, res) => {
  const { courseId } = req.params;
  try {
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const query = `
      SELECT am.* 
      FROM Attendance_Master am
      JOIN Class_Schedules cs ON am.session_id = cs.schedule_id
      WHERE cs.course_id = $1 AND cs.day_of_week = $2
      LIMIT 1
    `;
    const result = await db.pool.query(query, [courseId, dayOfWeek]);
    res.status(200).json(result.rows[0] || null);
  } catch (error) {
    console.error('❌ Get Today Master By Course Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🎥 Upload CCTV footage and run AI headcount
 */
exports.uploadCCTVFootage = async (req, res) => {
  const { session_id, hall_id } = req.body;
  if (!req.file) {
    return res.status(400).json({ message: "CCTV footage ගොනුවක් උඩුගත කරන්න." });
  }
  if (!session_id || !hall_id) {
    return res.status(400).json({ message: "Session ID සහ Hall ID අත්‍යවශ්‍ය වේ." });
  }

  try {
    const filePath = `uploads/${req.file.filename}`;
    
    // Call FastAPI headcount
    const headcountResult = await runAIProcess('headcount', { 
      zones: [{ zone_name: 'Uploaded Footage', camera_url: filePath }] 
    });
    
    const totalAIHeadcount = headcountResult.total_ai_headcount;
    const zoneResults = headcountResult.zone_breakdown;

    // Get course_id from this schedule (session_id = Class_Schedules.schedule_id)
    const scheduleRes = await db.pool.query(
      'SELECT course_id FROM Class_Schedules WHERE schedule_id = $1',
      [session_id]
    );
    const courseId = scheduleRes.rows[0]?.course_id;

    // Get REAL QR Count via attendance_sessions bridge
    let qrCount = 0;
    if (courseId) {
      const qrCountRes = await db.pool.query(
        `SELECT COUNT(DISTINCT sal.student_id) as count
         FROM Student_Attendance_Logs sal
         JOIN attendance_sessions asess ON sal.session_id = asess.session_id
         WHERE asess.course_id = $1
           AND sal.scanned_at::date = CURRENT_DATE`,
        [courseId]
      );
      qrCount = parseInt(qrCountRes.rows[0]?.count || '0', 10);
    }

    // Fetch AI threshold
    const settingsRes = await db.pool.query("SELECT setting_value FROM System_Settings WHERE setting_key = 'ai_mismatch_threshold'");
    const aiThreshold = settingsRes.rows[0]?.setting_value ? parseInt(settingsRes.rows[0].setting_value, 10) : 0;

    // Mismatch: AI sees more people than QR scans (someone is present without scanning)
    const mismatchDetected = totalAIHeadcount > qrCount + aiThreshold;

    // Get all students who scanned QR today (for this course) but not face verified yet
    let studentsRes = { rows: [] };
    if (courseId) {
      studentsRes = await db.pool.query(
        `SELECT DISTINCT s.student_id, s.student_name 
         FROM Students s
         JOIN Student_Attendance_Logs sal ON s.student_id = sal.student_id
         JOIN attendance_sessions asess ON sal.session_id = asess.session_id
         WHERE asess.course_id = $1
           AND sal.is_face_verified = FALSE
           AND sal.scanned_at::date = CURRENT_DATE`,
        [courseId]
      );
    }

    // ── NEW: Fetch scanned students with time & status ──────────────────────
    let scannedStudents = [];
    let notScannedStudents = [];
    if (courseId) {
      try {
        // ✅ QR scan කළ සිසුන් (today, this course)
        const scannedRes = await db.pool.query(
          `SELECT DISTINCT ON (s.student_id)
                  s.student_id,
                  s.student_name,
                  sal.attendance_status,
                  TO_CHAR(sal.scanned_at AT TIME ZONE 'Asia/Colombo', 'HH12:MI AM') AS scanned_time
           FROM Students s
           JOIN Student_Attendance_Logs sal ON s.student_id = sal.student_id
           WHERE sal.course_id = $1
             AND sal.scanned_at::date = CURRENT_DATE
           ORDER BY s.student_id, sal.scanned_at ASC`,
          [courseId]
        );
        scannedStudents = scannedRes.rows.map(r => ({
          id: r.student_id,
          name: r.student_name,
          status: r.attendance_status || 'Present',
          scanned_time: r.scanned_time
        }));

        // ❌ Enrolled නමුත් QR scan නොකළ සිසුන් (absent today)
        const scannedIds = scannedStudents.map(s => s.id);
        const notScannedRes = await db.pool.query(
          `SELECT s.student_id, s.student_name
           FROM Students s
           JOIN Course_Enrollments ce ON s.student_id = ce.student_id
           WHERE ce.course_id = $1
             AND ce.enrollment_status = 'Enrolled'
             AND s.student_id NOT IN (
               SELECT DISTINCT sal2.student_id
               FROM Student_Attendance_Logs sal2
               WHERE sal2.course_id = $1
                 AND sal2.scanned_at::date = CURRENT_DATE
             )
           ORDER BY s.student_name ASC`,
          [courseId]
        );
        notScannedStudents = notScannedRes.rows.map(r => ({
          id: r.student_id,
          name: r.student_name
        }));
      } catch (listErr) {
        // Graceful: student list fetch failure should NOT block the main response
        console.warn('⚠️ Student list fetch skipped:', listErr.message);
        scannedStudents = [];
        notScannedStudents = [];
      }
    }

    const verificationData = {
      unverified_students: studentsRes.rows.map(s => ({ id: s.student_id, name: s.student_name })),
      zone_details: zoneResults,
      image_paths: { 'Uploaded Footage': filePath }
    };

    // Update Attendance_Master
    const masterQuery = `
      INSERT INTO Attendance_Master (session_id, qr_count, ai_headcount, zone_details, mismatch_detected, verification_data, validated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (session_id) 
      DO UPDATE SET qr_count = $2, ai_headcount = $3, zone_details = $4, mismatch_detected = $5, verification_data = $6, validated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    await db.pool.query(masterQuery, [
      session_id, qrCount, totalAIHeadcount, JSON.stringify(zoneResults), mismatchDetected, JSON.stringify(verificationData)
    ]);

    // Insert into Suspicious_Attendance_Logs if mismatch
    if (mismatchDetected) {
      await auditService.logAction(req.user?.userId, req.user?.role, 'ALERT', 'Attendance', session_id, `Attendance mismatch via upload: QR ${qrCount} vs AI ${totalAIHeadcount}`);
      const suspiciousQuery = `
        INSERT INTO Suspicious_Attendance_Logs (session_id, qr_count, ai_headcount, zone_details, unverified_student_ids, image_paths, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
      `;
      const unverifiedIds = studentsRes.rows.map(s => s.student_id);
      await db.pool.query(suspiciousQuery, [
        session_id, qrCount, totalAIHeadcount, JSON.stringify(zoneResults), JSON.stringify(unverifiedIds), JSON.stringify({ 'Uploaded Footage': filePath })
      ]);
    }

    res.status(200).json({
      message: mismatchDetected ? '⚠️ විසංවාදයක් (Mismatch) හමුවිය!' : '✅ පැමිණීම තහවුරුයි.',
      data: {
        qr_count: qrCount,
        ai_headcount: totalAIHeadcount,
        mismatch_detected: mismatchDetected,
        threshold: aiThreshold,
        zone_breakdown: zoneResults,
        verification_data: verificationData,
        footage_url: filePath,
        annotated_image_url: null,
        scanned_students: scannedStudents,
        not_scanned_students: notScannedStudents
      }
    });

  } catch (error) {
    console.error('❌ Upload CCTV error:', error.message);
    res.status(500).json({ error: 'CCTV දර්ශන ගණනය කිරීම අසාර්ථකයි.' });
  }
};


/**
 * 🧬 Verify student face via webcam comparison
 */

exports.verifyFace = async (req, res) => {
  const { student_id, session_id, image_data } = req.body;

  if (!student_id || !session_id || !image_data) {
    return res.status(400).json({ message: "Student ID, Session ID සහ Image Data අත්‍යවශ්‍ය වේ." });
  }

  const fs = require('node:fs');
  const filename = `temp_webcam_${student_id}_${Date.now()}.jpg`;
  const tempFilePath = path.join(process.cwd(), 'uploads', filename);

  try {
    // Save base64 image
    const base64Data = image_data.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(tempFilePath, base64Data, 'base64');

    const relativePath = `uploads/${filename}`;

    // Get encoding from FastAPI
    const aiResult = await runAIProcess('encode', { image_path: relativePath });

    // Delete temp file
    try { fs.unlinkSync(tempFilePath); } catch (err) {}

    if (aiResult.error) {
      return res.status(400).json({ error: "ඡායාරූපයේ මුහුණක් හඳුනාගත නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න." });
    }

    const webcamEncoding = aiResult.encoding;

    // Get student registered encoding
    const studentRes = await db.pool.query(
      'SELECT student_name, face_encoding FROM Students WHERE student_id = $1',
      [student_id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: "ශිෂ්‍යයා හමුවුනේ නැත." });
    }

    const student = studentRes.rows[0];
    if (!student.face_encoding) {
      return res.status(400).json({ error: "මෙම ශිෂ්‍යයා සඳහා ලියාපදිංචි මුහුණු දත්ත සොයාගත නොහැක." });
    }

    const registeredEncoding = typeof student.face_encoding === 'string' ? JSON.parse(student.face_encoding) : student.face_encoding;

    // Calculate Euclidean distance
    let sum = 0;
    for (let i = 0; i < 128; i++) {
      sum += Math.pow(registeredEncoding[i] - webcamEncoding[i], 2);
    }
    const distance = Math.sqrt(sum);
    console.log(`DEBUG Face Compare student ${student_id}: distance = ${distance}`);

    // If distance < 0.55, it is verified (0.6 is official recommended, 0.55 is slightly stricter for security)
    if (distance < 0.55) {
      // 1. Mark as verified in student logs
      await db.pool.query(
        `UPDATE Student_Attendance_Logs 
         SET is_face_verified = TRUE, face_verified_at = CURRENT_TIMESTAMP 
         WHERE student_id = $1 AND session_id = $2 AND DATE(scanned_at) = CURRENT_DATE`,
        [student_id, session_id]
      );

      // 2. Remove from Attendance_Master unverified list
      const masterRes = await db.pool.query(
        'SELECT verification_data, ai_headcount FROM Attendance_Master WHERE session_id = $1',
        [session_id]
      );

      if (masterRes.rows.length > 0) {
        let vData = masterRes.rows[0].verification_data || {};
        if (vData.unverified_students) {
          vData.unverified_students = vData.unverified_students.filter(s => s.id !== parseInt(student_id, 10));
        }
        
        // Check if there are still mismatches
        const remainingUnverifiedCount = vData.unverified_students ? vData.unverified_students.length : 0;
        
        // Under user logic: the mismatch status remains flagged or we can clear mismatch_detected if it meets headcount logic.
        // Let's clear mismatch_detected = false only if unverified list is empty.
        const mismatchDetected = remainingUnverifiedCount > 0;

        await db.pool.query(
          'UPDATE Attendance_Master SET verification_data = $1, mismatch_detected = $2 WHERE session_id = $3',
          [JSON.stringify(vData), mismatchDetected, session_id]
        );
      }

      // 3. Try to generate annotated CCTV image with student name label (green)
      // Fetch stored footage URL from Attendance_Master verification_data
      let annotatedImageUrl = null;
      try {
        const masterForAnnotation = await db.pool.query(
          'SELECT verification_data FROM Attendance_Master WHERE session_id = $1',
          [session_id]
        );
        if (masterForAnnotation.rows.length > 0) {
          const vData = masterForAnnotation.rows[0].verification_data || {};
          const footagePath = vData.image_paths ? Object.values(vData.image_paths)[0] : null;
          const faceEncoding = typeof student.face_encoding === 'string'
            ? JSON.parse(student.face_encoding)
            : student.face_encoding;

          if (footagePath && faceEncoding) {
            const verifyResult = await runAIProcess('verify', {
              session_id: parseInt(session_id, 10),
              zones: [{ zone_name: 'Main', camera_url: footagePath }],
              expected_students: [{
                student_id: parseInt(student_id, 10),
                student_name: student.student_name,
                face_encoding: faceEncoding
              }]
            });

            const zoneData = verifyResult.verification_details?.Main;
            if (zoneData && zoneData.image_url) {
              annotatedImageUrl = zoneData.image_url;
            }
          }
        }
      } catch (annotationErr) {
        // Graceful: annotation failure should NOT block success response
        console.warn('⚠️ Annotated CCTV image generation skipped:', annotationErr.message);
      }

      return res.status(200).json({
        success: true,
        message: `✅ ${student.student_name} ගේ අනන්‍යතාවය සාර්ථකව තහවුරු විය.`,
        annotated_image_url: annotatedImageUrl
      });

    } else {
      return res.status(400).json({
        error: "මුහුණ ගැලපෙන්නේ නැත. කරුණාකර නැවත උත්සාහ කරන්න."
      });
    }

  } catch (error) {
    console.error('❌ verifyFace error:', error.message);
    // Cleanup if exists
    try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
    res.status(500).json({ error: error.message });
  }
};

// Handle Mark Fraud
exports.markFraud = async (req, res) => {
  const { session_id, unverified_student_ids } = req.body;

  if (!session_id || !unverified_student_ids || !Array.isArray(unverified_student_ids)) {
    return res.status(400).json({ message: "Invalid request data." });
  }

  try {
    // 1. Mark these students in Student_Attendance_Logs as fraud
    if (unverified_student_ids.length > 0) {
      await db.pool.query(
        `UPDATE Student_Attendance_Logs 
         SET is_face_verified = FALSE, remarks = 'FRAUD_DETECTED' 
         WHERE session_id = $1 AND student_id = ANY($2) AND DATE(scanned_at) = CURRENT_DATE`,
        [session_id, unverified_student_ids]
      );
    }

    // 2. Update Suspicious_Attendance_Logs
    await db.pool.query(
      `UPDATE Suspicious_Attendance_Logs 
       SET status = 'Confirmed Fraud', resolution_comment = 'Confirmed by Admin via Face Verification' 
       WHERE session_id = $1 AND status = 'Pending'`,
      [session_id]
    );

    // 3. Clear mismatch in Attendance_Master (since we handled the frauds)
    const masterRes = await db.pool.query(
      'SELECT verification_data FROM Attendance_Master WHERE session_id = $1',
      [session_id]
    );

    if (masterRes.rows.length > 0) {
      let vData = masterRes.rows[0].verification_data || {};
      vData.unverified_students = []; // Clear the unverified list

      await db.pool.query(
        'UPDATE Attendance_Master SET verification_data = $1, mismatch_detected = FALSE WHERE session_id = $2',
        [JSON.stringify(vData), session_id]
      );
    }

    res.status(200).json({ message: "හොර පැමිණීම් සාර්ථකව සටහන් කරන ලදී. (Fraud successfully marked)" });
  } catch (error) {
    console.error('❌ markFraud error:', error.message);
    res.status(500).json({ error: 'හොර පැමිණීම් සටහන් කිරීම අසාර්ථකයි.' });
  }
};

