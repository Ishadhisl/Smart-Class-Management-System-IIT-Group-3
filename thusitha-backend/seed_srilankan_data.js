const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'thusithaedu_db',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

const names = ["Kasun", "Nimesha", "Chamath", "Saduni", "Lahiru", "Nayana", "Amila", "Saman", "Kamal", "Nuwan", "Ruvini", "Gayani", "Sandun", "Lasitha", "Peshala", "Anura", "Dinesh", "Kavindu", "Ashan", "Piyumi"];
const lastNames = ["Perera", "Silva", "Fernando", "Bandara", "Jayasinghe", "De Silva", "Peiris", "Rathnayake", "Kumara", "Weerasinghe"];
const schools = ["Royal College", "Visakha Vidyalaya", "Ananda College", "Devi Balika Vidyalaya", "Nalanda College", "Maliyadeva College", "Kingswood College", "Mahamaya Girls' College", "Dharmaraja College", "Sujatha Vidyalaya"];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedData() {
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('123456', salt);

    console.log('Inserting Admin User...');
    const adminCheck = await pool.query('SELECT 1 FROM Users WHERE username = $1', ['admin']);
    if (adminCheck.rows.length === 0) {
      await pool.query('INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', passwordHash, 'Admin']);
      console.log('✅ Admin user created: admin / 123456');
    }

    const randStr = Math.random().toString(36).substring(2, 7);

    console.log('Inserting Teachers...');
    const teachersList = [
      { user: 'teacher_perera_' + randStr, name: 'Mr. Sunil Perera', spec: 'Science', role: 'Teacher' },
      { user: 'teacher_silva_' + randStr, name: 'Mrs. Nimali Silva', spec: 'Mathematics', role: 'Teacher' },
      { user: 'teacher_fernando_' + randStr, name: 'Mr. Ruwan Fernando', spec: 'Chemistry', role: 'Teacher' }
    ];
    let teacherIds = [];
    for (let t of teachersList) {
      // Skip if a teacher with this name already exists - the username always carries a
      // fresh random suffix, so without this check re-running the script creates a brand
      // new duplicate Teacher/User row every time instead of reusing the seeded one.
      const existing = await pool.query('SELECT teacher_id FROM Teachers WHERE teacher_name = $1', [t.name]);
      if (existing.rows.length > 0) {
        console.log(`⏭️  Teacher already seeded, skipping: ${t.name}`);
        teacherIds.push(existing.rows[0].teacher_id);
        continue;
      }
      let userRes = await pool.query('INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id', [t.user, passwordHash, t.role]);
      let uid = userRes.rows[0].user_id;
      let tRes = await pool.query('INSERT INTO Teachers (user_id, teacher_name, phone, email, specialization) VALUES ($1, $2, $3, $4, $5) RETURNING teacher_id',
        [uid, t.name, '077' + Math.floor(1000000 + Math.random() * 9000000), `${t.user}@test.com`, t.spec]);
      teacherIds.push(tRes.rows[0].teacher_id);
    }

    console.log('Inserting Parents and Students...');
    let studentIds = [];
    let parentIds = [];
    for (let i = 0; i < 20; i++) {
      let studentFirstName = names[i % names.length];
      let familyName = getRandom(lastNames);
      let studentName = `${studentFirstName} ${familyName}`;
      let parentName = `Mr. ${familyName}`;
      let pUser = `parent_${studentFirstName.toLowerCase()}_${randStr}_${i}`;
      let sUser = `student_${studentFirstName.toLowerCase()}_${randStr}_${i}`;

      // Insert Parent User
      let pUserRes = await pool.query('INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id', [pUser, passwordHash, 'Parent']);
      let pUid = pUserRes.rows[0].user_id;
      let parentRes = await pool.query('INSERT INTO Parents (user_id, parent_name, parent_phone, address) VALUES ($1, $2, $3, $4) RETURNING parent_id', 
        [pUid, parentName, '071' + Math.floor(1000000 + Math.random() * 9000000), 'Colombo']);
      let parentId = parentRes.rows[0].parent_id;
      parentIds.push(parentId);

      // Insert Student User
      let sUserRes = await pool.query('INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id', [sUser, passwordHash, 'Student']);
      let sUid = sUserRes.rows[0].user_id;
      let studentRes = await pool.query('INSERT INTO Students (user_id, parent_id, student_name, school, grade, qr_code_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING student_id', 
        [sUid, parentId, studentName, getRandom(schools), i % 2 === 0 ? 'Grade 10' : 'Grade 11', `QR-${sUser}`]);
      studentIds.push(studentRes.rows[0].student_id);
    }

    console.log('Inserting Subjects and Halls...');
    const subjectsList = ['O/L Science', 'O/L Mathematics', 'A/L Chemistry', 'A/L Physics'];
    let subjectIds = [];
    for (let s of subjectsList) {
      let res = await pool.query('INSERT INTO Subjects (subject_name, description) VALUES ($1, $2) RETURNING subject_id', [s, s + ' class']);
      subjectIds.push(res.rows[0].subject_id);
    }

    const hallsList = [{n: 'Hall A - Main Auditorium', c: 150}, {n: 'Hall B - Science Lab', c: 40}, {n: 'Hall C - Lecture Room', c: 60}];
    let hallIds = [];
    for (let h of hallsList) {
      let res = await pool.query('INSERT INTO Halls (hall_name, capacity) VALUES ($1, $2) RETURNING hall_id', [h.n, h.c]);
      hallIds.push(res.rows[0].hall_id);
    }

    console.log('Inserting Courses and Schedules...');
    const coursesList = [
      { name: 'Grade 10 Science - Sunil Perera', sub: subjectIds[0], tea: teacherIds[0], fee: 2000, day: 'Saturday', st: '08:00', et: '10:00', hall: hallIds[0] },
      { name: 'Grade 11 Mathematics - Nimali Silva', sub: subjectIds[1], tea: teacherIds[1], fee: 2000, day: 'Sunday', st: '14:00', et: '16:00', hall: hallIds[2] },
      { name: '2026 A/L Chemistry - Ruwan Fernando', sub: subjectIds[2], tea: teacherIds[2], fee: 3500, day: 'Monday', st: '15:30', et: '18:00', hall: hallIds[1] }
    ];
    let courseIds = [];
    for (let c of coursesList) {
      let res = await pool.query('INSERT INTO Courses (subject_id, teacher_id, course_name, monthly_fee) VALUES ($1, $2, $3, $4) RETURNING course_id', 
        [c.sub, c.tea, c.name, c.fee]);
      let courseId = res.rows[0].course_id;
      courseIds.push(courseId);
      await pool.query('INSERT INTO Class_Schedules (course_id, hall_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5)', 
        [courseId, c.hall, c.day, c.st, c.et]);
    }

    console.log('Enrolling Students...');
    for (let sid of studentIds) {
      // Enroll in 1 or 2 random courses
      let c1 = getRandom(courseIds);
      let c2 = getRandom(courseIds);
      await pool.query('INSERT INTO Course_Enrollments (student_id, course_id, enrollment_status) VALUES ($1, $2, $3)', [sid, c1, 'Active']);
      if (c1 !== c2) {
        await pool.query('INSERT INTO Course_Enrollments (student_id, course_id, enrollment_status) VALUES ($1, $2, $3)', [sid, c2, 'Active']);
      }
    }

    console.log('Creating Exams and Results...');
    let examIds = [];
    for (let cid of courseIds) {
      let res = await pool.query('INSERT INTO Exams (course_id, exam_name, exam_date, total_marks, pass_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING exam_id', 
        [cid, 'Term 1 Test', '2026-05-15', 100, 35]);
      examIds.push(res.rows[0].exam_id);
    }
    for (let sid of studentIds) {
      let enrRes = await pool.query('SELECT course_id FROM Course_Enrollments WHERE student_id = $1', [sid]);
      for (let enr of enrRes.rows) {
        let eRes = await pool.query('SELECT exam_id FROM Exams WHERE course_id = $1', [enr.course_id]);
        for (let ex of eRes.rows) {
          let marks = Math.floor(Math.random() * 61) + 40; // 40-100
          await pool.query('INSERT INTO Exam_Results (student_id, exam_id, marks) VALUES ($1, $2, $3)', [sid, ex.exam_id, marks]);
        }
      }
    }

    console.log('Creating Payments...');
    for (let sid of studentIds) {
      let enrRes = await pool.query('SELECT course_id FROM Course_Enrollments WHERE student_id = $1', [sid]);
      for (let enr of enrRes.rows) {
        await pool.query(`INSERT INTO Payments (student_id, course_id, issued_by, amount_paid, payment_method, for_month, receipt_number, payment_status, payment_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [sid, enr.course_id, null, 2000, 'Cash', 'June 2026', 'REC-' + Date.now() + '-' + Math.floor(Math.random()*10000), 'Paid']);
      }
    }

    console.log('Creating Attendance Records...');
    for (let sid of studentIds) {
      let enrRes = await pool.query('SELECT course_id FROM Course_Enrollments WHERE student_id = $1', [sid]);
      for (let enr of enrRes.rows) {
        await pool.query(`INSERT INTO Student_Attendance_Logs (student_id, course_id, attendance_status, scanned_at) VALUES ($1, $2, $3, NOW() - interval '7 days')`,
          [sid, enr.course_id, 'Present']);
        await pool.query(`INSERT INTO Student_Attendance_Logs (student_id, course_id, attendance_status, scanned_at) VALUES ($1, $2, $3, NOW())`,
          [sid, enr.course_id, Math.random() > 0.2 ? 'Present' : 'Late']);
      }
    }

    console.log('Creating Study Seats and Bookings...');
    let seatIds = [];
    for (let i=1; i<=10; i++) {
      let res = await pool.query("INSERT INTO Study_Seats (seat_status) VALUES ('Available') RETURNING seat_id");
      seatIds.push(res.rows[0].seat_id);
    }
    for (let i=0; i<3; i++) {
      await pool.query("UPDATE Study_Seats SET seat_status = 'Occupied' WHERE seat_id = $1", [seatIds[i]]);
      await pool.query(`INSERT INTO Study_Area_Bookings (student_id, seat_id, expected_arrival_time, actual_arrival_time, expiry_time, booking_status)
        VALUES ($1, $2, NOW() - interval '1 hour', NOW() - interval '55 minutes', NOW() + interval '2 hours', 'Confirmed')`,
        [studentIds[i], seatIds[i]]);
    }

    console.log('Creating Learning Materials...');
    for (let cid of courseIds) {
      await pool.query(`INSERT INTO Learning_Materials (course_id, teacher_id, material_title, material_type, uploaded_file, uploaded_at)
        VALUES ($1, (SELECT teacher_id FROM Courses WHERE course_id = $1), $2, $3, $4, NOW())`,
        [cid, 'Unit 1 Note', 'Document', '/uploads/dummy_note.pdf']);
    }

    console.log('Creating Promotions...');
    await pool.query(`INSERT INTO Promotions (title, content_type, description, image_url, created_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      ['2026 A/L New Intake', 'Image', 'Join our 2026 A/L batches today!', 'https://via.placeholder.com/600x400?text=2026+A/L+New+Intake']);

    console.log('Database successfully seeded with Sri Lankan context data!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedData();
