const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promoController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/imageUpload');

// Public route to get promotions
router.get('/', promoController.getPromos);

// Protected routes for managing promotions (Admin only)
router.post('/', verifyToken, checkRole(['Admin']), upload.single('file'), promoController.createPromo);
router.put('/:id', verifyToken, checkRole(['Admin']), upload.single('file'), promoController.updatePromo);
router.delete('/:id', verifyToken, checkRole(['Admin']), promoController.deletePromo);

module.exports = router;