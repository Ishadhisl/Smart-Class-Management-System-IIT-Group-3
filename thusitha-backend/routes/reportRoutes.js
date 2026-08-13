const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Protected routes for various reports
router.get('/revenue', verifyToken, checkRole(['Admin']), reportController.getMonthlyRevenue);
router.get('/current-month-revenue', verifyToken, checkRole(['Admin', 'Counter Person', 'Teacher']), reportController.getCurrentMonthRevenue);
router.get('/attendance-stats', verifyToken, checkRole(['Admin', 'Teacher', 'Counter Person']), reportController.getDailyAttendanceStats);
router.get('/punctuality', verifyToken, checkRole(['Admin', 'Teacher']), reportController.getStudentPunctuality);
router.get('/hall-utilization', verifyToken, checkRole(['Admin']), reportController.getHallUtilization);
router.get('/teacher-performance', verifyToken, checkRole(['Admin']), reportController.getTeacherPerformance);
router.get('/student-correlation', verifyToken, checkRole(['Admin']), reportController.getStudentCorrelation);
router.get('/congestion-history', verifyToken, checkRole(['Admin']), reportController.getCongestionHistory);

module.exports = router;