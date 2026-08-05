const db = require('../db');
const auditService = require('../utils/auditService');
const ExcelJS = require('exceljs'); // Assuming ExcelJS is used for uploadExcelMarks
const { google } = require('googleapis');

exports.createExam = async (req, res) => {
  const { course_id, exam_name, exam_date, total_marks, pass_percentage } = req.body;
  try {
    const result = await db.pool.query(
      'INSERT INTO Exams (course_id, exam_name, exam_date, total_marks, pass_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [course_id, exam_name, exam_date, total_marks, pass_percentage]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Exam', result.rows[0].exam_id, `Created exam: ${exam_name}`);
    res.status(201).json({ message: 'විභාගය සාර්ථකව ඇතුළත් කළා!', exam: result.rows[0] });
  } catch (err) {
    console.error('❌ Create Exam Error:', err.message);
    res.status(500).json({ error: 'විභාගය ඇතුළත් කිරීම අසාර්ථකයි.' });
  }
};

exports.getCourseExams = async (req, res) => {
  const { courseId } = req.params;
  try {
    const result = await db.pool.query('SELECT * FROM Exams WHERE course_id = $1 ORDER BY exam_date DESC', [courseId]);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get Course Exams Error:', err.message);
    res.status(500).json({ error: 'විභාග ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.getExamResults = async (req, res) => {
  const { examId } = req.params;
  try {
    let query;
    let params;

    if (req.user?.role === 'Student') {
      // 🛡️ Privacy Protection: Students can only view their own marks
      const studentRes = await db.pool.query('SELECT student_id FROM Students WHERE user_id = $1', [req.user.userId]);
      if (studentRes.rows.length === 0) {
        return res.status(404).json({ message: "ශිෂ්‍ය ගිණුම සොයාගත නොහැකි විය." });
      }
      const studentId = studentRes.rows[0].student_id;
      query = `
        SELECT s.qr_code_key as student_id, s.student_name, er.marks
        FROM Exam_Results er
        JOIN Students s ON er.student_id = s.student_id
        WHERE er.exam_id = $1 AND er.student_id = $2;
      `;
      params = [examId, studentId];
    } else {
      query = `
        SELECT s.qr_code_key as student_id, s.student_name, er.marks
        FROM Exam_Results er
        JOIN Students s ON er.student_id = s.student_id
        WHERE er.exam_id = $1
        ORDER BY s.student_name ASC;
      `;
      params = [examId];
    }

    const result = await db.pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get Exam Results Error:', err.message);
    res.status(500).json({ error: 'විභාග ප්‍රතිඵල ලබා ගැනීමට නොහැකි විය.' });
  }
};

exports.uploadExcelMarks = async (req, res) => {
  const { exam_id } = req.body;
  if (!req.file) {
    return res.status(400).json({ message: 'කරුණාකර Excel ගොනුවක් උඩුගත කරන්න.' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.getWorksheet(1);
    const marksToInsert = [];

    const getCellValue = (cell) => {
      if (!cell || cell.value === null || cell.value === undefined) return null;
      const val = cell.value;
      if (typeof val === 'object') {
        if (val.result !== undefined && val.result !== null) return val.result;
        if (val.richText && Array.isArray(val.richText)) return val.richText.map(t => t.text || '').join('');
        if (val.text !== undefined && val.text !== null) return val.text;
      }
      return val;
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      const cellValue1 = getCellValue(row.getCell(1));
      const cellValue2 = getCellValue(row.getCell(2));
      const cellValue3 = getCellValue(row.getCell(3));

      if (cellValue1 !== undefined && cellValue1 !== null) {
        const student_id = String(cellValue1).trim();
        let parsedMarks = NaN;

        // Try reading marks from Column B
        if (cellValue2 !== undefined && cellValue2 !== null) {
          parsedMarks = Number.parseFloat(cellValue2);
        }
        
        // If Column B is not a number (e.g. it is a Name), try Column C
        if (isNaN(parsedMarks) && cellValue3 !== undefined && cellValue3 !== null) {
          parsedMarks = Number.parseFloat(cellValue3);
        }

        if (student_id && !isNaN(parsedMarks)) {
          marksToInsert.push({ student_id, marks: parsedMarks });
        }
      }
    });

    if (marksToInsert.length === 0) {
      return res.status(400).json({ message: 'Excel ගොනුවේ වලංගු දත්ත නොමැත.' });
    }

    // Batch insert/update marks
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const skippedStudents = [];
      let successCount = 0;
      for (const mark of marksToInsert) {
        let studentDbId = null;
        // Map the student QR code/ID string (e.g. ST001) to database serial ID (flexible match with or without 'QR-' prefix)
        const studentLookup = await client.query(
          "SELECT student_id FROM Students WHERE LOWER(qr_code_key) = LOWER($1) OR LOWER(qr_code_key) = 'qr-' || LOWER($1)",
          [String(mark.student_id)]
        );
        if (studentLookup.rows.length > 0) {
          studentDbId = studentLookup.rows[0].student_id;
        } else {
          const parsed = parseInt(mark.student_id, 10);
          if (!isNaN(parsed)) {
            studentDbId = parsed;
          }
        }

        if (studentDbId) {
          await client.query(
            'INSERT INTO Exam_Results (student_id, exam_id, marks) VALUES ($1, $2, $3) ON CONFLICT (student_id, exam_id) DO UPDATE SET marks = EXCLUDED.marks',
            [studentDbId, exam_id, mark.marks]
          );
          successCount++;
        } else {
          skippedStudents.push(mark.student_id);
        }
      }

      if (successCount === 0 && marksToInsert.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `ගොනුවේ සිටි කිසිදු ශිෂ්‍යයෙකු හඳුනා ගැනීමට නොහැකි විය. ශිෂ්‍ය අංක නිවැරදි දැයි බලන්න. (හමුනොවූ ශිෂ්‍ය අංක: ${skippedStudents.join(', ')})`
        });
      }

      await client.query('COMMIT');
      await auditService.logAction(req.user.userId, req.user.role, 'UPLOAD', 'Exam_Results', exam_id, `Uploaded marks for exam ID: ${exam_id}`);
      
      if (skippedStudents.length > 0) {
        res.status(200).json({
          message: 'ලකුණු සාර්ථකව ඇතුළත් කළා!',
          warning: `පහත ශිෂ්‍ය අංක පද්ධතියේ හමු නොවූ නිසා මඟ හැර ඇත: ${skippedStudents.join(', ')}`
        });
      } else {
        res.status(200).json({ message: 'ලකුණු සාර්ථකව ඇතුළත් කළා!' });
      }
    } catch (transactionErr) {
      await client.query('ROLLBACK');
      throw transactionErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Upload Excel Marks Error:', err.message);
    res.status(500).json({ error: 'ලකුණු උඩුගත කිරීම අසාර්ථකයි.' });
  }
};

exports.updateExam = async (req, res) => {
  const { id } = req.params;
  const { exam_name, exam_date, total_marks, pass_percentage } = req.body;
  try {
    const result = await db.pool.query(
      'UPDATE Exams SET exam_name = $1, exam_date = $2, total_marks = $3, pass_percentage = $4 WHERE exam_id = $5 RETURNING *',
      [exam_name, exam_date, total_marks, pass_percentage, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'විභාගය හමුවුනේ නැත.' });
    }
    await auditService.logAction(req.user?.userId, req.user?.role, 'UPDATE', 'Exams', id, `Updated exam: ${exam_name}`);
    res.json({ message: 'විභාගය සාර්ථකව යාවත්කාලීන කළා!', exam: result.rows[0] });
  } catch (err) {
    console.error('❌ Update Exam Error:', err.message);
    res.status(500).json({ error: 'විභාගය යාවත්කාලීන කිරීම අසාර්ථකයි.' });
  }
};

exports.deleteExam = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.pool.query('DELETE FROM Exams WHERE exam_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'විභාගය හමුවුනේ නැත.' });
    }
    await auditService.logAction(req.user?.userId, req.user?.role, 'DELETE', 'Exams', id, `Deleted exam: ${result.rows[0].exam_name}`);
    res.json({ message: 'විභාගය සාර්ථකව මකා දැමුවා!' });
  } catch (err) {
    console.error('❌ Delete Exam Error:', err.message);
    res.status(500).json({ error: 'විභාගය මකා දැමීම අසාර්ථකයි. (මෙම විභාගයට ලකුණු ඇතුළත් කර ඇත්නම් එය මකා දැමිය නොහැක)' });
  }
};

/**
 * 📊 Pull Exam Marks from Google Sheets directly
 */
exports.pullGoogleSheetMarks = async (req, res) => {
  const { exam_id, sheet_id, range = 'Sheet1!A2:B' } = req.body;
  if (!exam_id || !sheet_id) {
    return res.status(400).json({ message: 'exam_id සහ sheet_id අත්‍යවශ්‍ය වේ.' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet_id,
      range: range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: 'Google Sheet එකෙහි දත්ත නොමැත.' });
    }

    const marksToInsert = [];
    rows.forEach(row => {
      const student_id = row[0] ? String(row[0]).trim() : null;
      const marks = row[1];
      if (student_id && marks !== undefined && marks !== null) {
        const parsedMarks = Number.parseFloat(marks);
        if (!isNaN(parsedMarks)) {
          marksToInsert.push({ student_id, marks: parsedMarks });
        }
      }
    });

    if (marksToInsert.length === 0) {
      return res.status(400).json({ message: 'Google Sheet එකෙහි වලංගු දත්ත නොමැත.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const skippedStudents = [];
      let successCount = 0;
      for (const mark of marksToInsert) {
        let studentDbId = null;
        // Map the student QR code/ID string (e.g. ST001) to database serial ID (flexible match with or without 'QR-' prefix)
        const studentLookup = await client.query(
          "SELECT student_id FROM Students WHERE LOWER(qr_code_key) = LOWER($1) OR LOWER(qr_code_key) = 'qr-' || LOWER($1)",
          [String(mark.student_id)]
        );
        if (studentLookup.rows.length > 0) {
          studentDbId = studentLookup.rows[0].student_id;
        } else {
          const parsed = parseInt(mark.student_id, 10);
          if (!isNaN(parsed)) {
            studentDbId = parsed;
          }
        }

        if (studentDbId) {
          await client.query(
            'INSERT INTO Exam_Results (student_id, exam_id, marks) VALUES ($1, $2, $3) ON CONFLICT (student_id, exam_id) DO UPDATE SET marks = EXCLUDED.marks',
            [studentDbId, exam_id, mark.marks]
          );
          successCount++;
        } else {
          skippedStudents.push(mark.student_id);
        }
      }

      if (successCount === 0 && marksToInsert.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `ගොනුවේ සිටි කිසිදු ශිෂ්‍යයෙකු හඳුනා ගැනීමට නොහැකි විය. ශිෂ්‍ය අංක නිවැරදි දැයි බලන්න. (හමුනොවූ ශිෂ්‍ය අංක: ${skippedStudents.join(', ')})`
        });
      }

      await client.query('COMMIT');
      await auditService.logAction(req.user?.userId, req.user?.role, 'UPLOAD', 'Exam_Results', exam_id, `Pulled marks from Google Sheet ${sheet_id}`);
      
      if (skippedStudents.length > 0) {
        res.status(200).json({
          message: `Google Sheet එකෙන් ලකුණු ${successCount} ක් සාර්ථකව ඇතුළත් කළා!`,
          warning: `පහත ශිෂ්‍ය අංක පද්ධතියේ හමු නොවූ නිසා මඟ හැර ඇත: ${skippedStudents.join(', ')}`
        });
      } else {
        res.status(200).json({ message: `Google Sheet එකෙන් ලකුණු ${successCount} ක් සාර්ථකව ඇතුළත් කළා!` });
      }
    } catch (transactionErr) {
      await client.query('ROLLBACK');
      throw transactionErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Google Sheets Error:', err.message);
    res.status(500).json({ error: 'Google Sheet එකෙන් දත්ත ලබා ගැනීම අසාර්ථකයි.', details: err.message });
  }
};