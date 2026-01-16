const express = require('express');
const authController = require('../controllers/authController');
const { jwtAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

// Protected routes (require JWT token)
router.get('/me', jwtAuth, authController.getProfile.bind(authController));
router.get('/verify', jwtAuth, authController.verifyToken.bind(authController));

module.exports = router;
