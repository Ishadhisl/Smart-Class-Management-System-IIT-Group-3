const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

const upload = require('../middleware/imageUpload');

// Public route for landing page
router.get('/public', achievementController.getPublicAchievements);

// Protected routes
router.use(verifyToken);
router.get('/', checkRole(['Admin', 'Teacher', 'Counter Person', 'Student', 'Parent']), achievementController.getAchievements);
router.post('/', checkRole(['Admin']), upload.single('photo'), achievementController.createAchievement);
router.put('/:id', checkRole(['Admin']), upload.single('photo'), achievementController.updateAchievement);
router.delete('/:id', checkRole(['Admin']), achievementController.deleteAchievement);

module.exports = router;
