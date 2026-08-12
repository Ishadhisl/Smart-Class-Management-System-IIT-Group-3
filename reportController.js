const db = require('../db');

exports.getMonthlyRevenue = async (req, res) => {
  try {
    const query = `
      SELECT 
        TO_CHAR(payment_date, 'Month') AS month,
        SUM(amount_paid) AS total
      FROM Payments
      GROUP BY TO_CHAR(payment_date, 'Month'), EXTRACT(MONTH FROM payment_date)
      ORDER BY EXTRACT(MONTH FROM payment_date)
    `;
    const result = await db.pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Report Error:', error.message);
    res.status(500).json({ message: "වාර්තා ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

exports.getDailyAttendanceStats = async (req, res) => {
  try {
    const query = `
      SELECT attendance_status AS status, COUNT(*) AS count
      FROM Student_Attendance_Logs
      WHERE DATE(scanned_at) = CURRENT_DATE
      GROUP BY attendance_status
    `;
    const result = await db.pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Attendance Report Error:', error.message);
    res.status(500).json({ message: "පැමිණීමේ වාර්තා ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

// නව වාර්තාව: ශිෂ්‍යයන්ගේ වේලානුරූපීභාවය (Punctuality Report)
exports.getStudentPunctuality = async (req, res) => { // 💡 Accepts optional startDate and endDate
  const { startDate, endDate, courseId } = req.query;
  let dateFilter = '';
  const queryParams = [];

  if (courseId) {
    queryParams.push(courseId);
    dateFilter += ` AND sal.course_id = $${queryParams.length}`;
  }
  if (startDate) {
    queryParams.push(startDate);
    dateFilter += ` AND sal.scanned_at >= $${queryParams.length}::date`;
  }
  if (endDate) {
    queryParams.push(endDate);
    dateFilter += ` AND sal.scanned_at <= $${queryParams.length}::date + INTERVAL '1 day' - INTERVAL '1 second'`; // End of the day
  }

  try {
    const query = `
      SELECT 
        s.student_id, 
        s.student_name, 
        p.parent_name,
        p.parent_phone,
        COUNT(*) FILTER (WHERE sal.attendance_status = 'Late') AS late_count,
        COUNT(*) AS total_attendance
      FROM Student_Attendance_Logs sal
      JOIN Students s ON sal.student_id = s.student_id
      LEFT JOIN Parents p ON s.parent_id = p.parent_id
      WHERE 1=1 ${dateFilter}
      GROUP BY s.student_id, s.student_name, p.parent_name, p.parent_phone
      HAVING COUNT(*) FILTER (WHERE sal.attendance_status = 'Late') > 0
      ORDER BY late_count DESC, s.student_name ASC
    `;
    const result = await db.pool.query(query, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Punctuality Report Error:', error.message);
    res.status(500).json({ message: "වේලානුරූපීභාවය වාර්තාව ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

// නව වාර්තාව: ශාලා භාවිතය පිළිබඳ වාර්තාව (Hall Utilization Report)
exports.getHallUtilization = async (req, res) => {
  try {
    const query = `
      SELECT 
        h.hall_name, 
        h.capacity,
        COUNT(DISTINCT cs.schedule_id) AS total_classes,
        COALESCE(SUM(EXTRACT(EPOCH FROM (cs.end_time - cs.start_time))/3600), 0)::DECIMAL(10,2) AS total_hours,
        COUNT(DISTINCT sal.log_id) AS mismatch_count,
        -- 🛡️ Industrial Safety Score: Perfect 100, -5 per congestion incident
        GREATEST(0, 100 - (COUNT(DISTINCT cl.log_id) * 5)) AS safety_score
      FROM Halls h
      LEFT JOIN Class_Schedules cs ON h.hall_id = cs.hall_id
      LEFT JOIN Suspicious_Attendance_Logs sal ON cs.schedule_id = sal.session_id
      LEFT JOIN Hall_Congestion_Logs cl ON h.hall_id = cl.hall_id
      GROUP BY h.hall_id, h.hall_name, h.capacity
      ORDER BY total_hours DESC NULLS LAST;
    `;
    const result = await db.pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "ශාලා වාර්තාව ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

// නව වාර්තාව: ගුරුවරුන්ගේ කාර්ය සාධන සාරාංශය (Teacher Performance Report)
exports.getTeacherPerformance = async (req, res) => {
  try {
    const query = `
      SELECT 
        t.teacher_name,
        COUNT(DISTINCT cs.schedule_id) AS classes_taught,
        ROUND(100 - (COUNT(sal.log_id) FILTER (WHERE sal.attendance_status = 'Late')::decimal / NULLIF(COUNT(sal.log_id), 0) * 100), 2) || '%' AS avg_punctuality,
        ROUND(COUNT(er.marks) FILTER (WHERE (er.marks::decimal / e.total_marks * 100) >= e.pass_percentage)::decimal / NULLIF(COUNT(er.marks), 0) * 100, 2) || '%' AS avg_exam_pass
      FROM Teachers t
      LEFT JOIN Courses c ON t.teacher_id = c.teacher_id
      LEFT JOIN Class_Schedules cs ON c.course_id = cs.course_id
      LEFT JOIN Student_Attendance_Logs sal ON c.course_id = sal.course_id
      LEFT JOIN Exams e ON c.course_id = e.course_id
      LEFT JOIN Exam_Results er ON e.exam_id = er.exam_id
      GROUP BY t.teacher_id, t.teacher_name
      ORDER BY t.teacher_name ASC;
    `;
    const result = await db.pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Teacher Performance Report Error:', error.message);
    res.status(500).json({ message: "ගුරු කාර්ය සාධන වාර්තාව ලබා ගැනීමට නොහැකි විය.", error: error.message });
  }
};

/**
 * 📈 Calculates the correlation between student punctuality and exam results.
 */
exports.getStudentCorrelation = async (req, res) => {
  try {
    const query = `
      SELECT 
        s.student_id,
        s.student_name,
        ROUND((COUNT(*) FILTER (WHERE sal.attendance_status = 'Present')::decimal / NULLIF(COUNT(sal.log_id), 0) * 100), 2) as punctuality_score,
        ROUND(AVG(er.marks::decimal / e.total_marks * 100), 2) as avg_marks
      FROM Students s
      JOIN Student_Attendance_Logs sal ON s.student_id = sal.student_id
      JOIN Exam_Results er ON s.student_id = er.student_id
      JOIN Exams e ON er.exam_id = e.exam_id
      GROUP BY s.student_id, s.student_name
      HAVING COUNT(sal.log_id) > 0 AND COUNT(er.marks) > 0
      ORDER BY avg_marks DESC;
    `;
    const result = await db.pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Correlation Report Error:', error.message);
    res.status(500).json({ message: "සම්බන්ධතා වාර්තාව ලබා ගැනීමට නොහැකි විය." });
  }
};

/**
 * 📜 Get Historical Congestion Data for Reporting.
 */
exports.getCongestionHistory = async (req, res) => {
  try {
    const query = `
      SELECT 
        h.hall_name, 
        COUNT(cl.log_id) AS incident_count, 
        MAX(cl.peak_count) AS highest_peak,
        ROUND(AVG(cl.duration_minutes))::INT AS avg_duration
      FROM Halls h
      JOIN Hall_Congestion_Logs cl ON h.hall_id = cl.hall_id
      GROUP BY h.hall_name
      ORDER BY incident_count DESC;
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Congestion History Report Error:', err.message);
    res.status(500).json({ error: 'කාලසටහන් දත්ත ලබා ගැනීමට නොහැකි විය.', details: err.message });
  }
};