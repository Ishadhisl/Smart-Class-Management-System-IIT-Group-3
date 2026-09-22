const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// Protected route to get all users (excluding students) - read-only, so Counter Person can
// also see the total (e.g. for their dashboard stat tile); mutations below stay Admin-only.
router.get('/', verifyToken, checkRole(['Admin', 'Counter Person']), userController.getAllUsers);

// Create new user (Admin/Counter Person)
router.post('/', verifyToken, checkRole(['Admin']), userController.createUser);

// Delete user
router.delete('/:id', verifyToken, checkRole(['Admin']), userController.deleteUser);

// Reset password route
router.post('/reset-password/:id', verifyToken, checkRole(['Admin']), userController.resetPassword);

// Session management (Admin: view/force-logout any user's active login sessions)
router.get('/sessions/active', verifyToken, checkRole(['Admin']), userController.getAllActiveSessions);
router.delete('/sessions/:sessionId', verifyToken, checkRole(['Admin']), userController.revokeUserSession);

module.exports = router;