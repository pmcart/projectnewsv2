const superAdminService = require('../services/superAdminService');

class SuperAdminController {
  // ==================== ORGANIZATION ENDPOINTS ====================

  /**
   * List all organizations
   * GET /api/super-admin/organizations
   */
  async listOrganizations(req, res, next) {
    try {
      const { search, isActive, page = 1, limit = 20 } = req.query;

      const result = await superAdminService.listOrganizations({
        search,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single organization
   * GET /api/super-admin/organizations/:id
   */
  async getOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const organization = await superAdminService.getOrganization(parseInt(id));

      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      res.json(organization);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new organization
   * POST /api/super-admin/organizations
   */
  async createOrganization(req, res, next) {
    try {
      const { name, slug, isActive } = req.body;

      // Validate required fields
      if (!name || !slug) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'slug']
        });
      }

      // Validate slug format
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(slug)) {
        return res.status(400).json({
          error: 'Invalid slug format',
          message: 'Slug must be lowercase letters, numbers, and hyphens only'
        });
      }

      const organization = await superAdminService.createOrganization({ name, slug, isActive });
      res.status(201).json(organization);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Organization with this slug already exists' });
      }
      next(error);
    }
  }

  /**
   * Update an organization
   * PUT /api/super-admin/organizations/:id
   */
  async updateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { name, slug, isActive } = req.body;

      // Validate slug format if provided
      if (slug) {
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug)) {
          return res.status(400).json({
            error: 'Invalid slug format',
            message: 'Slug must be lowercase letters, numbers, and hyphens only'
          });
        }
      }

      const organization = await superAdminService.updateOrganization(parseInt(id), { name, slug, isActive });
      res.json(organization);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Organization with this slug already exists' });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Organization not found' });
      }
      next(error);
    }
  }

  /**
   * Delete an organization
   * DELETE /api/super-admin/organizations/:id
   */
  async deleteOrganization(req, res, next) {
    try {
      const { id } = req.params;
      await superAdminService.deleteOrganization(parseInt(id));
      res.json({ message: 'Organization deleted successfully' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Organization not found' });
      }
      if (error.code === 'P2003') {
        return res.status(409).json({
          error: 'Cannot delete organization',
          message: 'Organization has associated users, documents, or videos. Please remove them first.'
        });
      }
      next(error);
    }
  }

  // ==================== USER ENDPOINTS ====================

  /**
   * List all users
   * GET /api/super-admin/users
   */
  async listUsers(req, res, next) {
    try {
      const { search, organizationId, role, isActive, isSuperAdmin, page = 1, limit = 20 } = req.query;

      const result = await superAdminService.listUsers({
        search,
        organizationId: organizationId ? parseInt(organizationId) : undefined,
        role,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        isSuperAdmin: isSuperAdmin === 'true' ? true : isSuperAdmin === 'false' ? false : undefined,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single user
   * GET /api/super-admin/users/:id
   */
  async getUser(req, res, next) {
    try {
      const { id } = req.params;
      const user = await superAdminService.getUser(parseInt(id));

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new user
   * POST /api/super-admin/users
   */
  async createUser(req, res, next) {
    try {
      const { email, password, firstName, lastName, role, organizationId, isActive, isSuperAdmin } = req.body;

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

      // Validate password length
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

      const user = await superAdminService.createUser({
        email,
        password,
        firstName,
        lastName,
        role,
        organizationId: organizationId ? parseInt(organizationId) : null,
        isActive,
        isSuperAdmin
      });

      res.status(201).json(user);
    } catch (error) {
      if (error.message === 'User with this email already exists') {
        return res.status(409).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Update a user
   * PUT /api/super-admin/users/:id
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      const { email, firstName, lastName, role, organizationId, isActive, isSuperAdmin, password } = req.body;

      // Prevent super-admin from removing their own super-admin status
      if (req.user.userId === userId && isSuperAdmin === false) {
        return res.status(400).json({
          error: 'Cannot remove your own super-admin status',
          message: 'Another super-admin must do this for you'
        });
      }

      // Validate email format if provided
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
      }

      // Validate password length if provided
      if (password && password.length < 6) {
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

      const user = await superAdminService.updateUser(userId, {
        email,
        firstName,
        lastName,
        role,
        organizationId: organizationId !== undefined ? (organizationId ? parseInt(organizationId) : null) : undefined,
        isActive,
        isSuperAdmin,
        password
      });

      res.json(user);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      next(error);
    }
  }

  /**
   * Delete a user
   * DELETE /api/super-admin/users/:id
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      // Prevent super-admin from deleting themselves
      if (req.user.userId === userId) {
        return res.status(400).json({
          error: 'Cannot delete your own account',
          message: 'Another super-admin must do this for you'
        });
      }

      await superAdminService.deleteUser(userId);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      if (error.code === 'P2003') {
        return res.status(409).json({
          error: 'Cannot delete user',
          message: 'User has associated documents or videos. Please reassign or delete them first.'
        });
      }
      next(error);
    }
  }

  // ==================== STATS ENDPOINT ====================

  /**
   * Get system statistics
   * GET /api/super-admin/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await superAdminService.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SuperAdminController();
