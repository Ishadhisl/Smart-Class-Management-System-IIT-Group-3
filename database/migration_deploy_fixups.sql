-- Deploy fixups: columns/constraints that controllers already use but which never
-- made it into a committed migration (they only existed on someone's local DB via a
-- manual ALTER). Kept together here and applied automatically on backend startup by
-- thusitha-backend/utils/initSchema.js. Every statement is idempotent and safe to
-- re-run on every boot.

-- studentController.registerStudent / updateStudent / getAllStudents read+write this.
ALTER TABLE Students ADD COLUMN IF NOT EXISTS address TEXT;

-- courseController filters every non-admin course query on is_active and soft-deletes
-- by setting it false. Missing column => course lists break for Counter/Student/public.
ALTER TABLE Courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
UPDATE Courses SET is_active = TRUE WHERE is_active IS NULL;

-- achievementController.createAchievement / updateAchievement write image_url, and
-- AchievementTab / LandingPage read it. It was never in schema.sql or any migration.
ALTER TABLE Student_Achievements ADD COLUMN IF NOT EXISTS image_url TEXT;

-- achieved_year was NOT NULL; the Admin form allows leaving it blank. Controller now
-- defaults it, but drop the hard constraint so older/blank rows can't 500 the insert.
ALTER TABLE Student_Achievements ALTER COLUMN achieved_year DROP NOT NULL;

-- ── Attendance / face-verification columns ────────────────────────────────────
-- attendanceController.verifyFace / markFraud / getTodayLogsByCourse all read/write
-- these, but schema.sql's Student_Attendance_Logs only has the 5 original columns.
-- Missing them => the Face Verification panel and CCTV validation 500 on every call.
ALTER TABLE Student_Attendance_Logs ADD COLUMN IF NOT EXISTS is_face_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE Student_Attendance_Logs ADD COLUMN IF NOT EXISTS face_verified_at TIMESTAMP;
ALTER TABLE Student_Attendance_Logs ADD COLUMN IF NOT EXISTS remarks TEXT;

-- attendance_status started as CHECK IN ('Present','Late'); manual attendance and the
-- fraud/absent flows use other values. Drop the constraint rather than chase every value.
ALTER TABLE Student_Attendance_Logs DROP CONSTRAINT IF EXISTS student_attendance_logs_attendance_status_check;

-- Suspicious_Attendance_Logs.status was CHECK IN ('Pending','Resolved') but markFraud
-- sets 'Confirmed Fraud' and resolve flows set 'Resolved'/'Confirmed Fraud'.
ALTER TABLE Suspicious_Attendance_Logs DROP CONSTRAINT IF EXISTS suspicious_attendance_logs_status_check;

-- ── Teacher CCTV-access requests ──────────────────────────────────────────────
-- A teacher asks an Admin for permission to view their class's CCTV footage in the
-- AI monitoring panel; the Admin approves/denies from the home dashboard.
CREATE TABLE IF NOT EXISTS CCTV_Access_Requests (
    request_id SERIAL PRIMARY KEY,
    teacher_id INT REFERENCES Teachers(teacher_id) ON DELETE CASCADE,
    course_id INT REFERENCES Courses(course_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'Pending',
    note TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_by INT REFERENCES Users(user_id) ON DELETE SET NULL,
    decided_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cctv_access_status ON CCTV_Access_Requests(status);
CREATE INDEX IF NOT EXISTS idx_cctv_access_teacher ON CCTV_Access_Requests(teacher_id);
