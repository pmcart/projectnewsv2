// src/middleware/auth.js
const authService = require('../services/authService');
const prisma = require('../config/prisma');

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

    // Verify token signature and expiry
    const decoded = await authService.verifyToken(token);

    // Re-validate user against database on every request.
    // This ensures deactivated users and changed roles are caught immediately,
    // not after the JWT expires (up to 7 days).
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        isSuperAdmin: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Account is inactive or does not exist' });
    }

    // Use fresh data from DB, not stale JWT claims
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      isSuperAdmin: user.isSuperAdmin
    };

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

// Alias for convenience
const requireAuth = jwtAuth;

/**
 * Organization membership middleware
 * Ensures the authenticated user belongs to an organization
 * Use after jwtAuth middleware
 */
function requireOrganization(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.organizationId) {
    return res.status(403).json({
      error: 'Organization membership required',
      message: 'You must belong to an organization to access this resource'
    });
  }

  next();
}

/**
 * Validates that a resource belongs to the user's organization
 * @param {number} resourceOrgId - The organizationId of the resource
 * @param {number} userOrgId - The user's organizationId
 * @returns {boolean} True if resource belongs to user's org
 */
function belongsToOrganization(resourceOrgId, userOrgId) {
  return resourceOrgId === userOrgId;
}

/**
 * Super-admin authorization middleware
 * Use after jwtAuth middleware
 * Requires user to have isSuperAdmin = true
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      error: 'Super-admin access required',
      message: 'This endpoint is restricted to super-administrators'
    });
  }

  next();
}

module.exports = {
  apiKeyAuth,
  jwtAuth,
  requireAuth,
  requireRole,
  requireOrganization,
  belongsToOrganization,
  requireSuperAdmin
};
