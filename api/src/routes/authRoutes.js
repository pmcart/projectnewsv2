const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { jwtAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limiters for public auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes (rate-limited)
router.post('/register', registerLimiter, authController.register.bind(authController));
router.post('/login', loginLimiter, authController.login.bind(authController));

// Protected routes (require JWT token)
router.get('/me', jwtAuth, authController.getProfile.bind(authController));
router.get('/verify', jwtAuth, authController.verifyToken.bind(authController));

module.exports = router;
