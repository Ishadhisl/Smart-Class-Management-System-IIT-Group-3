const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware'); // Assuming you have an upload middleware

// Protected routes for exam management
router.get('/upcoming', verifyToken, checkRole(['Admin', 'Counter Person', 'Teacher', 'Student']), examController.getUpcomingExams);
router.post('/', verifyToken, checkRole(['Admin', 'Teacher']), examController.createExam);
router.get('/course/:courseId', verifyToken, checkRole(['Admin', 'Teacher', 'Student']), examController.getCourseExams);
router.get('/results/:examId', verifyToken, checkRole(['Admin', 'Teacher', 'Student']), examController.getExamResults); // Assuming getExamResults exists in controller
router.post('/upload-marks', verifyToken, checkRole(['Admin', 'Teacher']), upload.single('file'), examController.uploadExcelMarks);
router.post('/pull-sheet-marks', verifyToken, checkRole(['Admin', 'Teacher']), examController.pullGoogleSheetMarks);
router.put('/:id', verifyToken, checkRole(['Admin', 'Teacher']), examController.updateExam);
router.delete('/:id', verifyToken, checkRole(['Admin']), examController.deleteExam);

module.exports = router;