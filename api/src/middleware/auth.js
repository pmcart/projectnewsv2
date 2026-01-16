// src/middleware/auth.js
const authService = require('../services/authService');

/**
 * API Key authentication middleware (existing)
 */
function apiKeyAuth(req, res, next) {
  const clientKey = req.header('x-api-key');
  const serverKey = process.env.API_KEY;

  if (!serverKey) {
    console.warn('⚠️ API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (!clientKey || clientKey !== serverKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
}

/**
 * JWT authentication middleware
 * Verifies JWT token from Authorization header
 * Adds user data to req.user if valid
 */
async function jwtAuth(req, res, next) {
  try {
    // Get token from Authorization header (format: "Bearer <token>")
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token and get user data
    const decoded = await authService.verifyToken(token);

    // Attach user data to request object
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-based authorization middleware
 * Use after jwtAuth middleware
 * @param  {...string} allowedRoles - Roles that are allowed to access the route
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
}

module.exports = { apiKeyAuth, jwtAuth, requireRole };
