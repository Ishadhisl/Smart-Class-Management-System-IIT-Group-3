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
