const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

const ADMIN_COUNTER = ['Admin', 'Counter Person'];

// ═══════════════════════════════════════
// 📊 WhatsApp Connection Management
// ═══════════════════════════════════════
router.get('/whatsapp-status', verifyToken, checkRole(ADMIN_COUNTER), smsController.getWhatsAppStatus);
router.get('/whatsapp-qr', verifyToken, checkRole(ADMIN_COUNTER), smsController.getWhatsAppQr);
router.post('/whatsapp-reconnect', verifyToken, checkRole(ADMIN_COUNTER), smsController.reconnectWhatsApp);
router.post('/whatsapp-logout', verifyToken, checkRole(['Admin']), smsController.logoutWhatsApp);

// ═══════════════════════════════════════
// 📋 Log Management
// ═══════════════════════════════════════
router.get('/logs', verifyToken, checkRole(ADMIN_COUNTER), smsController.getSmsLogs);
router.delete('/logs/:logId', verifyToken, checkRole(['Admin']), smsController.deleteSmsLog);

// ═══════════════════════════════════════
// 🔄 Resend
// ═══════════════════════════════════════
router.post('/resend/:logId', verifyToken, checkRole(ADMIN_COUNTER), smsController.resendSms);
router.post('/bulk-resend', verifyToken, checkRole(ADMIN_COUNTER), smsController.bulkResendSms);
router.post('/bulk-resend-ids', verifyToken, checkRole(ADMIN_COUNTER), smsController.bulkResendSmsByIds);

// ═══════════════════════════════════════
// 💬 Send Messages
// ═══════════════════════════════════════
router.post('/send-custom', verifyToken, checkRole(ADMIN_COUNTER), smsController.sendCustomSms);
router.post('/send-reminder', verifyToken, checkRole(ADMIN_COUNTER), smsController.sendReminderWhatsApp);

module.exports = router;