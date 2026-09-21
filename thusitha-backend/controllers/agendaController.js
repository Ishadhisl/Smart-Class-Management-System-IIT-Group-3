const db = require('../db');
const moodleService = require('../utils/moodleService');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "Today's agenda" for the login popup: classes scheduled today, exams dated today, and
// (best-effort) Assignment/Quiz due dates the teacher set up directly in Moodle - those
// never land in SCMS's own DB, so they're fetched live from Moodle's calendar feed for
// this user rather than synced/stored anywhere.
exports.getTodayAgenda = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const now = new Date();
    const todayName = DAY_NAMES[now.getDay()];
    const todayDateStr = now.toISOString().slice(0, 10);

    let courseIds = [];
    let moodleUserId = null;
    let moodleUsername = null;

    if (role === 'Student') {
      const sres = await db.pool.query(
        `SELECT s.student_id, s.moodle_user_id, u.username
         FROM Students s JOIN Users u ON s.user_id = u.user_id
         WHERE s.user_id = $1`,
        [userId]
      );
      if (sres.rows.length) {
        const student = sres.rows[0];
        moodleUserId = student.moodle_user_id || null;
        moodleUsername = student.username;
        const enrRes = await db.pool.query(
          `SELECT course_id FROM Course_Enrollments WHERE student_id = $1 AND enrollment_status IN ('Enrolled', 'Active')`,
          [student.student_id]
        );
        courseIds = enrRes.rows.map((r) => r.course_id);
      }
    } else if (role === 'Teacher') {
      const tres = await db.pool.query(
        `SELECT t.teacher_id, u.username
         FROM Teachers t JOIN Users u ON t.user_id = u.user_id
         WHERE t.user_id = $1`,
        [userId]
      );
      if (tres.rows.length) {
        const teacher = tres.rows[0];
        moodleUsername = teacher.username;
        const cRes = await db.pool.query('SELECT course_id FROM Courses WHERE teacher_id = $1', [teacher.teacher_id]);
        courseIds = cRes.rows.map((r) => r.course_id);
      }
    } else {
      // Admin / Counter Person: institute-wide agenda for the day.
      const cRes = await db.pool.query('SELECT course_id FROM Courses WHERE is_active = true');
      courseIds = cRes.rows.map((r) => r.course_id);
    }

    let classesToday = [];
    let examsToday = [];
    if (courseIds.length > 0) {
      const classRes = await db.pool.query(
        `SELECT cs.schedule_id, cs.start_time, cs.end_time, c.course_name, h.hall_name
         FROM Class_Schedules cs
         JOIN Courses c ON cs.course_id = c.course_id
         LEFT JOIN Halls h ON cs.hall_id = h.hall_id
         WHERE cs.course_id = ANY($1::int[]) AND cs.day_of_week = $2
         ORDER BY cs.start_time`,
        [courseIds, todayName]
      );
      classesToday = classRes.rows;

      const examRes = await db.pool.query(
        `SELECT e.exam_id, e.exam_name, e.exam_date, c.course_name
         FROM Exams e
         JOIN Courses c ON e.course_id = c.course_id
         WHERE e.course_id = ANY($1::int[]) AND e.exam_date = $2`,
        [courseIds, todayDateStr]
      );
      examsToday = examRes.rows;
    }

    // Best-effort: Moodle Assignment/Quiz due today. Degrades to an empty list on any
    // failure (Moodle down, function not enabled yet, user has no Moodle account, etc.) -
    // this popup should never break over a Moodle hiccup.
    let moodleEventsToday = [];
    try {
      if (!moodleUserId && moodleUsername) {
        const mu = await moodleService.getUserByUsername(moodleUsername);
        if (mu && mu.id) moodleUserId = mu.id;
      }
      if (moodleUserId) {
        const startOfDay = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime() / 1000);
        const endOfDay = startOfDay + 86400;
        const events = await moodleService.getActionEventsForUser(moodleUserId, startOfDay, endOfDay);
        moodleEventsToday = events.map((e) => ({
          name: e.name,
          course: e.course && e.course.fullname,
          url: (e.action && e.action.actionurl) || e.url || null,
          timesort: e.timesort,
        }));
      }
    } catch (mErr) {
      console.warn('⚠️ Moodle agenda fetch skipped:', mErr.message);
    }

    const hasAny = classesToday.length > 0 || examsToday.length > 0 || moodleEventsToday.length > 0;

    res.json({
      date: todayDateStr,
      dayName: todayName,
      hasAny,
      classes: classesToday,
      exams: examsToday,
      moodleEvents: moodleEventsToday,
    });
  } catch (error) {
    console.error('❌ Get Today Agenda Error:', error.message);
    res.status(500).json({ message: 'අද දිනයේ කාලසටහන ලබා ගැනීමට නොහැකි විය.', error: error.message });
  }
};
