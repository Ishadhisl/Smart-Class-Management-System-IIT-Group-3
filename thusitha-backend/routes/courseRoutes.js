const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Public route to get all courses
router.get('/public', courseController.getAllCourses);
// Protected route to get all courses (for dashboard)
router.get('/', verifyToken, checkRole(['Admin', 'Counter Person', 'Teacher', 'Student']), courseController.getAllCourses);
router.post('/', verifyToken, checkRole(['Admin']), courseController.createCourse);
router.put('/:id', verifyToken, checkRole(['Admin']), courseController.updateCourse);
router.delete('/:id', verifyToken, checkRole(['Admin']), courseController.deleteCourse);
router.put('/:id/restore', verifyToken, checkRole(['Admin']), courseController.restoreCourse);

module.exports = router;