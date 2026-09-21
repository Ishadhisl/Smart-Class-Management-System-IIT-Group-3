const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/imageUpload');

// Public route for pre-registration
router.post('/register-public', studentController.publicRegistration);

// Self-service: logged-in student fetching their own profile (must be before other routes)
router.get('/me', verifyToken, checkRole(['Student']), studentController.getMyProfile);

// Protected routes (Admin, Counter Person, Teacher roles)
router.get('/', verifyToken, checkRole(['Admin', 'Counter Person', 'Teacher']), studentController.getAllStudents);
router.post('/', verifyToken, checkRole(['Admin', 'Counter Person']), studentController.registerStudent);
router.put('/:id', verifyToken, checkRole(['Admin', 'Counter Person']), studentController.updateStudent);
router.delete('/:id', verifyToken, checkRole(['Admin']), studentController.deleteStudent);

// Pending registrations (Counter Person)
router.get('/pending', verifyToken, checkRole(['Admin', 'Counter Person']), studentController.getPendingRegistrations);
router.get('/next-id', verifyToken, checkRole(['Admin', 'Counter Person']), studentController.getNextStudentIds);
router.post('/approve', verifyToken, checkRole(['Admin', 'Counter Person']), studentController.approveStudent);
router.post('/bulk-encode', verifyToken, checkRole(['Admin', 'Counter Person']), studentController.bulkGenerateEncodings);
router.post('/encode/:studentId', verifyToken, checkRole(['Admin', 'Counter Person']), studentController.generateFaceEncoding);
router.post('/:id/upload-photo', verifyToken, checkRole(['Admin', 'Counter Person']), upload.single('photo'), studentController.uploadPhoto);
module.exports = router;