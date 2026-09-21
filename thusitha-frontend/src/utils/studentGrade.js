// Students.grade is free text ("Grade 11", "11", "12-AL", "Grade 13"...). Pull out the first
// number; null when there's no grade recorded yet.
export const gradeNumber = (grade) => {
  const m = String(grade || '').match(/\d{1,2}/);
  return m ? parseInt(m[0], 10) : null;
};
// ID cards are issued up to Grade 11 (O/L). A/L students (12/13) don't get the button; a
// student with no grade recorded keeps it until the grade is filled in.
export const canIssueIdCard = (student) => {
  const g = gradeNumber(student?.grade);
  return g === null || g <= 11;
};
