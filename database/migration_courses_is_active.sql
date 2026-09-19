-- courseController.js's getAllCourses queries `is_active`, but no committed migration
-- ever added it to Courses - someone's local database had it from an untracked manual
-- ALTER. Without this, GET /api/courses/public (and any other Courses query filtering
-- on is_active) fails with "column is_active does not exist" on a freshly-restored DB.
ALTER TABLE Courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
UPDATE Courses SET is_active = true WHERE is_active IS NULL;
