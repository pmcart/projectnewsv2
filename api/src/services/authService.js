const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
}
const JWT_EXPIRES_IN = '7d'; // 7 days as per user preference

// In-memory login attempt tracking (per email)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const loginAttempts = new Map(); // email -> { count, lockedUntil }

class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User's email
   * @param {string} userData.password - User's plain text password
   * @param {string} userData.firstName - User's first name
   * @param {string} userData.lastName - User's last name
   * @param {string} [userData.role='READER'] - User's role (READER, WRITER, EDITOR)
   * @param {number} [userData.organizationId] - Organization ID
   * @returns {Promise<Object>} Created user without password
   */
  async register({ email, password, firstName, lastName, role = 'READER', organizationId }) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role,
        organizationId,
      },
      include: {
        organization: true,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Login user and generate JWT token
   * @param {string} email - User's email
   * @param {string} password - User's plain text password
   * @returns {Promise<Object>} User data and JWT token
   */
  async login(email, password) {
    const normalizedEmail = email.toLowerCase();

    // Check if account is locked out
    const attempts = loginAttempts.get(normalizedEmail);
    if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const minutesLeft = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      throw new Error(`Account temporarily locked. Try again in ${minutesLeft} minute(s).`);
    }

    // Find user by email with organization
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        organization: true,
      },
    });

    if (!user) {
      this._recordFailedAttempt(normalizedEmail);
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this._recordFailedAttempt(normalizedEmail);
      throw new Error('Invalid email or password');
    }

    // Successful login - clear failed attempts
    loginAttempts.delete(normalizedEmail);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        isSuperAdmin: user.isSuperAdmin,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Record a failed login attempt and lock account if threshold exceeded
   */
  _recordFailedAttempt(email) {
    const attempts = loginAttempts.get(email) || { count: 0, lockedUntil: null };
    attempts.count += 1;

    if (attempts.count >= MAX_FAILED_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      attempts.count = 0; // reset count for next lockout window
    }

    loginAttempts.set(email, attempts);
  }

  /**
   * Verify JWT token and return user data
   * @param {string} token - JWT token
   * @returns {Promise<Object>} User data from token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - User's ID
   * @returns {Promise<Object>} User data without password
   */
  async getUserById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

module.exports = new AuthService();
