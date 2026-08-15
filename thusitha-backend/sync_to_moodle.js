const db = require('./db');
const moodleService = require('./utils/moodleService');

const getNextOccurrences = (dayName, timeStr, count = 4) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return [];

  const occurrences = [];
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  let current = new Date();
  current.setHours(hours, minutes, 0, 0);
  
  // Find upcoming occurrences
  for (let i = 0; i < 30 && occurrences.length < count; i++) {
    if (current.getDay() === targetDay && current > new Date()) {
      occurrences.push(Math.floor(current.getTime() / 1000));
    }
    current.setDate(current.getDate() + 1);
  }
  return occurrences;
};

async function syncAll() {
  console.log("=== Starting Moodle Synchronization ===");
  try {
    // 1. Sync Courses first
    const coursesRes = await db.pool.query('SELECT * FROM Courses');
    console.log(`Found ${coursesRes.rows.length} courses in local database.`);
    
    // Store mapping from local course_id to Moodle's internal course id
    const courseIdMap = {};

    for (const course of coursesRes.rows) {
      console.log(`\n📚 Checking Course: ${course.course_name} (Local ID: ${course.course_id})...`);
      try {
        const moodleCourse = await moodleService.findOrCreateCourse(course.course_id, course.course_name);
        if (moodleCourse && moodleCourse.id) {
          courseIdMap[course.course_id] = moodleCourse.id;
          console.log(`  └─ ✅ Moodle Course ID: ${moodleCourse.id}`);
        }
      } catch (err) {
        console.error(`  └─ ❌ Failed to find/create course:`, err.message);
      }
    }

    // 2. Sync Schedules to Moodle Calendar for the next 4 weeks
    console.log("\n=== Synchronizing Class Schedules to Moodle Calendar ===");
    const schedulesRes = await db.pool.query(`
      SELECT cs.*, c.course_name 
      FROM Class_Schedules cs 
      JOIN Courses c ON cs.course_id = c.course_id
    `);
    console.log(`Found ${schedulesRes.rows.length} schedules in local database.`);

    for (const schedule of schedulesRes.rows) {
      const moodleCourseId = courseIdMap[schedule.course_id];
      if (moodleCourseId) {
        console.log(`\n📅 Syncing Schedule for ${schedule.course_name} (Moodle Course ID: ${moodleCourseId}) on ${schedule.day_of_week} at ${schedule.start_time}...`);
        const occurrences = getNextOccurrences(schedule.day_of_week, schedule.start_time, 4);
        for (const timestart of occurrences) {
          try {
            const dateStr = new Date(timestart * 1000).toLocaleString();
            console.log(`  └─ Creating Calendar Event for ${dateStr}...`);
            await moodleService.createCalendarEvent({
              name: `${schedule.course_name} - Lecture`,
              description: `Weekly scheduled class for ${schedule.course_name}`,
              moodleCourseId: moodleCourseId,
              timestart: timestart
            });
            console.log(`  └─ ✅ Created successfully.`);
          } catch (err) {
            console.error(`  └─ ❌ Failed to create event:`, err.message);
          }
        }
      } else {
        console.log(`\n⚠️ Cannot sync schedule for ${schedule.course_name}: Moodle course not resolved.`);
      }
    }

    // 3. Sync Students and their Enrollments
    const studentsRes = await db.pool.query(`
      SELECT s.student_id, s.student_name, u.username, s.moodle_user_id 
      FROM Students s 
      JOIN Users u ON s.user_id = u.user_id
    `);
    console.log(`\nFound ${studentsRes.rows.length} students in local database.`);
    
    for (const student of studentsRes.rows) {
      // Moodle usernames must be lowercase alphanumeric
      const username = student.username.toLowerCase().replace(/[^a-z0-9]/g, '');
      const nameParts = student.student_name.split(' ');
      let moodleUserId = student.moodle_user_id;

      // findOrCreateUser looks up by username first, so a student whose Moodle account
      // already exists (but whose moodle_user_id never got saved back locally - the
      // original bug here) is found and reused instead of the sync giving up on them.
      try {
        const moodleUser = await moodleService.findOrCreateUser({
          username,
          firstname: nameParts[0] || username,
          lastname: nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Student',
          email: `${username}@thusitha.edu.lk`
        });
        if (moodleUser && moodleUser.id) {
          moodleUserId = moodleUser.id;
          if (moodleUserId !== student.moodle_user_id) {
            await db.pool.query('UPDATE Students SET moodle_user_id = $1 WHERE student_id = $2', [moodleUserId, student.student_id]);
          }
          console.log(`\n👤 ${student.student_name} (${username}) → Moodle user ID: ${moodleUserId}`);
        }
      } catch (err) {
        console.error(`\n👤 ❌ Failed to find/create Moodle user for ${username}:`, err.message);
        continue; // no Moodle user id at all - nothing to enroll
      }

      // 4. Fetch local enrollments and sync with Moodle
      if (moodleUserId) {
        const enrollmentsRes = await db.pool.query(`
          SELECT ce.course_id, c.course_name 
          FROM Course_Enrollments ce 
          JOIN Courses c ON ce.course_id = c.course_id 
          WHERE ce.student_id = $1 AND ce.enrollment_status IN ('Active', 'Enrolled')
        `, [student.student_id]);
        
        for (const enrollment of enrollmentsRes.rows) {
          const moodleCourseId = courseIdMap[enrollment.course_id];
          if (moodleCourseId) {
            try {
              console.log(`  └─ Enrolling in course ${enrollment.course_name} (Moodle Course ID: ${moodleCourseId})...`);
              await moodleService.enrollUser(moodleUserId, moodleCourseId);
              console.log(`  └─ ✅ Enrolled successfully.`);
            } catch (err) {
              console.error(`  └─ ❌ Enrollment failed:`, err.message);
            }
          } else {
            console.log(`  └─ ⚠️ Cannot enroll in ${enrollment.course_name}: Moodle course not found/created.`);
          }
        }
      }
    }
    
    console.log("\n=== Moodle Synchronization Completed Successfully! ===");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal Error during Moodle Sync:", err.message);
    process.exit(1);
  }
}

syncAll();
