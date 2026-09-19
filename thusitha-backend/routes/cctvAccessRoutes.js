const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cctvAccessController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Teacher
router.post('/request', checkRole(['Teacher']), ctrl.requestAccess);
router.get('/mine', checkRole(['Teacher']), ctrl.myAccess);

// Admin
router.get('/pending', checkRole(['Admin']), ctrl.pending);
router.post('/:id/decide', checkRole(['Admin']), ctrl.decide);

module.exports = router;
