const authService = require('../services/authService');

class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   * Body: { email, password, firstName, lastName, role? }
   */
  async register(req, res) {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['email', 'password', 'firstName', 'lastName']
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters long'
        });
      }

      // Validate role if provided
      const validRoles = ['READER', 'WRITER', 'EDITOR'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          error: 'Invalid role',
          validRoles
        });
      }

      const user = await authService.register({
        email,
        password,
        firstName,
        lastName,
        role
      });

      res.status(201).json({
        message: 'User registered successfully',
        user
      });
    } catch (error) {
      if (error.message === 'User with this email already exists') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   * Body: { email, password }
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      const result = await authService.login(email, password);

      res.json({
        message: 'Login successful',
        ...result
      });
    } catch (error) {
      if (error.message === 'Invalid email or password' || error.message === 'Account is inactive') {
        return res.status(401).json({ error: error.message });
      }
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   * Requires JWT authentication
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await authService.getUserById(userId);

      res.json({ user });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  }

  /**
   * Verify token
   * GET /api/auth/verify
   * Requires JWT authentication
   */
  async verifyToken(req, res) {
    // If we reach here, the JWT middleware has already verified the token
    res.json({
      valid: true,
      user: req.user
    });
  }
}

module.exports = new AuthController();
