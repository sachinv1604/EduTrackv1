/**
 * User & Profile Management Routes
 * 
 * Maps URL paths to userController.js. 
 * These endpoints handle personal data and Admin/Coordinator actions.
 */
const express = require('express');
const router = express.Router();
const { 
  updateFCMToken,
  getStudentsByRoute,
  getUsersByRole,
  updateUserRole,
  getPendingApprovals,
  approveUser,
  getMe
} = require('../controllers/userController');
const { protect, roleCheck } = require('../middleware/auth');

/**
 * 1. PERSONAL UPDATES
 * URL: GET /api/users/me -> Get own profile
 * URL: POST /api/users/fcm-token -> Save push notification token
 */
router.get('/me', protect, getMe);
router.post('/fcm-token', protect, updateFCMToken);

/**
 * 2. COORDINATOR ACTIONS
 * URL: GET /api/users/route-students
 * Allows a coordinator to see all students assigned to their bus.
 */
router.get('/route-students', protect, roleCheck(['coordinator']), getStudentsByRoute);

/**
 * 3. REGISTRATION APPROVALS
 * Both Admin and Coordinators can see/approve new users.
 * Logic inside the controller ensures they only see what they are allowed.
 */
router.get('/pending-approvals', protect, roleCheck(['admin', 'coordinator']), getPendingApprovals);
router.put('/:id/approve', protect, roleCheck(['admin', 'coordinator']), approveUser);

/**
 * 4. ADMIN USER MANAGEMENT
 * These endpoints allow full role switching and role-based searching.
 */
router.get('/role/:role', protect, roleCheck(['admin']), getUsersByRole);
router.put('/:id/role', protect, roleCheck(['admin']), updateUserRole);

module.exports = router;
