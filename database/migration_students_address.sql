-- studentController.js's registerStudent/updateStudent/getAllStudents all read/write
-- Students.address, but no committed migration ever added it - same class of gap as
-- Courses.is_active (see migration_courses_is_active.sql): someone's local database had
-- it from an untracked manual ALTER.
ALTER TABLE Students ADD COLUMN IF NOT EXISTS address TEXT;
