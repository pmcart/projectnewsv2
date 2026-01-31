const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { jwtAuth, requireSuperAdmin } = require('../middleware/auth');

// All routes require JWT authentication + super-admin status
router.use(jwtAuth);
router.use(requireSuperAdmin);

// ==================== ORGANIZATION ROUTES ====================
router.get('/organizations', superAdminController.listOrganizations.bind(superAdminController));
router.post('/organizations', superAdminController.createOrganization.bind(superAdminController));
router.get('/organizations/:id', superAdminController.getOrganization.bind(superAdminController));
router.put('/organizations/:id', superAdminController.updateOrganization.bind(superAdminController));
router.delete('/organizations/:id', superAdminController.deleteOrganization.bind(superAdminController));

// ==================== USER ROUTES ====================
router.get('/users', superAdminController.listUsers.bind(superAdminController));
router.post('/users', superAdminController.createUser.bind(superAdminController));
router.get('/users/:id', superAdminController.getUser.bind(superAdminController));
router.put('/users/:id', superAdminController.updateUser.bind(superAdminController));
router.delete('/users/:id', superAdminController.deleteUser.bind(superAdminController));

// ==================== STATS ROUTE ====================
router.get('/stats', superAdminController.getStats.bind(superAdminController));

module.exports = router;
