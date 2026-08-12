const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public route for login
router.post('/login', authController.login);
// Protected route for password reset (requires authentication)
router.post('/reset-password', verifyToken, authController.resetPassword);

// Forgot Password — WhatsApp OTP flow (3 steps)
router.post('/forgot-password', authController.forgotPassword);     // Step 1: Send OTP
router.post('/verify-otp', authController.verifyOtp);               // Step 2: Verify OTP
router.post('/reset-with-otp', authController.resetWithOtp);        // Step 3: New Password

// Protected route for changing password (first-time student login)
router.post('/change-password', verifyToken, authController.changePassword);

// Protected route for logout
router.post('/logout', verifyToken, authController.logout);

module.exports = router;