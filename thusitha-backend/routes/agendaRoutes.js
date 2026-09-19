const express = require('express');
const router = express.Router();
const agendaController = require('../controllers/agendaController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/today', verifyToken, agendaController.getTodayAgenda);

module.exports = router;
