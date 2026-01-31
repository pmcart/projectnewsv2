const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

class SuperAdminService {
  // ==================== ORGANIZATION METHODS ====================

  /**
   * List all organizations with pagination and search
   * @param {Object} options - Query options
   * @param {string} [options.search] - Search term for name/slug
   * @param {boolean} [options.isActive] - Filter by active status
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Items per page
   * @returns {Promise<Object>} Paginated organizations
   */
  async listOrganizations({ search, isActive, page = 1, limit = 20 }) {
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              documents: true,
              videos: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.organization.count({ where })
    ]);

    return {
      organizations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get a single organization by ID
   * @param {number} id - Organization ID
   * @returns {Promise<Object|null>} Organization with users and counts
   */
  async getOrganization(id) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            isSuperAdmin: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            documents: true,
            videos: true
          }
        }
      }
    });
  }

  /**
   * Create a new organization
   * @param {Object} data - Organization data
   * @param {string} data.name - Organization name
   * @param {string} data.slug - URL-friendly slug
   * @param {boolean} [data.isActive=true] - Active status
   * @returns {Promise<Object>} Created organization
   */
  async createOrganization({ name, slug, isActive = true }) {
    return prisma.organization.create({
      data: { name, slug, isActive },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
  }

  /**
   * Update an organization
   * @param {number} id - Organization ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated organization
   */
  async updateOrganization(id, { name, slug, isActive }) {
    const data = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (isActive !== undefined) data.isActive = isActive;

    return prisma.organization.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { users: true }
        }
      }
    });
  }

  /**
   * Delete an organization
   * @param {number} id - Organization ID
   * @returns {Promise<Object>} Deleted organization
   */
  async deleteOrganization(id) {
    return prisma.organization.delete({ where: { id } });
  }

  // ==================== USER METHODS ====================

  /**
   * List all users with pagination and filters
   * @param {Object} options - Query options
   * @param {string} [options.search] - Search term for email/name
   * @param {number} [options.organizationId] - Filter by organization
   * @param {string} [options.role] - Filter by role
   * @param {boolean} [options.isActive] - Filter by active status
   * @param {boolean} [options.isSuperAdmin] - Filter by super-admin status
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Items per page
   * @returns {Promise<Object>} Paginated users
   */
  async listUsers({ search, organizationId, role, isActive, isSuperAdmin, page = 1, limit = 20 }) {
    const where = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isSuperAdmin !== undefined) {
      where.isSuperAdmin = isSuperAdmin;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isSuperAdmin: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get a single user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object|null>} User without password
   */
  async getUser(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        organization: true
      }
    });

    if (!user) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Create a new user
   * @param {Object} data - User data
   * @returns {Promise<Object>} Created user without password
   */
  async createUser({ email, password, firstName, lastName, role = 'READER', organizationId, isActive = true, isSuperAdmin = false }) {
    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
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
        organizationId: organizationId || null,
        isActive,
        isSuperAdmin
      },
      include: {
        organization: true
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update a user
   * @param {number} id - User ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated user without password
   */
  async updateUser(id, { email, firstName, lastName, role, organizationId, isActive, isSuperAdmin, password }) {
    const data = {};

    if (email !== undefined) data.email = email.toLowerCase();
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (role !== undefined) data.role = role;
    if (organizationId !== undefined) data.organizationId = organizationId;
    if (isActive !== undefined) data.isActive = isActive;
    if (isSuperAdmin !== undefined) data.isSuperAdmin = isSuperAdmin;

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: {
        organization: true
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Delete a user
   * @param {number} id - User ID
   * @returns {Promise<Object>} Deleted user
   */
  async deleteUser(id) {
    return prisma.user.delete({ where: { id } });
  }

  // ==================== STATS METHODS ====================

  /**
   * Get system-wide statistics
   * @returns {Promise<Object>} Dashboard statistics
   */
  async getStats() {
    const [
      orgCount,
      activeOrgCount,
      userCount,
      activeUserCount,
      superAdminCount,
      usersByRole,
      recentOrgs,
      recentUsers
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isSuperAdmin: true } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),
      prisma.organization.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, slug: true, createdAt: true }
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          organization: { select: { name: true } }
        }
      })
    ]);

    return {
      organizations: {
        total: orgCount,
        active: activeOrgCount,
        inactive: orgCount - activeOrgCount
      },
      users: {
        total: userCount,
        active: activeUserCount,
        inactive: userCount - activeUserCount,
        superAdmins: superAdminCount,
        byRole: Object.fromEntries(usersByRole.map(r => [r.role, r._count.role]))
      },
      recent: {
        organizations: recentOrgs,
        users: recentUsers
      }
    };
  }
}

module.exports = new SuperAdminService();
