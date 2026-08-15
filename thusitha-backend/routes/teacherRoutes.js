const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/public', teacherController.getPublicTeachers);
router.get('/', verifyToken, checkRole(['Admin', 'Teacher', 'Counter Person']), teacherController.getAllTeachers);
router.get('/my-students', verifyToken, checkRole(['Teacher']), teacherController.getMyStudents);
router.post('/register', verifyToken, checkRole(['Admin']), upload.single('photo'), teacherController.registerTeacher);
router.put('/:id', verifyToken, checkRole(['Admin']), upload.single('photo'), teacherController.updateTeacher);
router.delete('/:id', verifyToken, checkRole(['Admin']), teacherController.deleteTeacher);

module.exports = router;