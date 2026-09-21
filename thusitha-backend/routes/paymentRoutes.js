const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Protected routes for payment management
router.post('/', verifyToken, checkRole(['Admin', 'Counter Person']), paymentController.recordPayment);
router.get('/', verifyToken, checkRole(['Admin', 'Counter Person', 'Teacher']), paymentController.getAllPayments);
router.post('/create-checkout-session', verifyToken, checkRole(['Student']), paymentController.createStripeSession);
router.post('/manual', verifyToken, checkRole(['Student']), upload.single('receipt'), paymentController.submitManualPayment);
router.get('/student/:studentId', verifyToken, checkRole(['Admin', 'Counter Person', 'Parent', 'Student']), paymentController.getStudentPayments);
router.post('/remind', verifyToken, checkRole(['Admin', 'Counter Person']), paymentController.sendLatePaymentReminders);

router.post('/:id/upload-confirmation', verifyToken, checkRole(['Admin', 'Counter Person', 'Student', 'Parent']), upload.single('receipt'), paymentController.uploadConfirmation);
router.put('/:id/verify', verifyToken, checkRole(['Admin', 'Counter Person']), paymentController.verifyPayment);
router.get('/:id/receipt', verifyToken, checkRole(['Admin', 'Counter Person', 'Student', 'Parent']), paymentController.getReceipt);
router.get('/reports/overdue', verifyToken, checkRole(['Admin', 'Counter Person', 'Teacher']), paymentController.getOverduePayments);

// PayHere Integration
router.post('/payhere/initiate', verifyToken, checkRole(['Student']), paymentController.initiatePayHereCheckout);
router.post('/payhere/notify', paymentController.handlePayHereNotify); // No auth: server-to-server callback from PayHere
router.get('/payhere/status/:orderId', verifyToken, paymentController.getPayHerePaymentStatus);

module.exports = router;