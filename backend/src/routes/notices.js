/**
 * Notice & Announcement Routes
 * 
 * Maps URL paths to announcement logic. 
 * Note how we combine AUTH, PERMISSIONS, and FILE UPLOADS in one chain.
 */
const express = require('express');
const router = express.Router();
const { createNotice, getNotices } = require('../controllers/noticeController');
const { protect, roleCheck } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

/**
 * 1. CREATE NOTICE
 * URL: POST /api/notices
 * 
 * Middleware Chain:
 * - protect: Is the user logged in?
 * - roleCheck: Is the user an Admin or Coordinator?
 * - upload.single: If they sent a file, save it to the disk.
 * - finally -> createNotice: Save the text and the file path to the Database.
 */
router.post(
  '/', 
  protect, 
  roleCheck(['admin', 'coordinator']), 
  upload.single('attachment'), // Matches the "attachment" key in form-data
  createNotice
);

/**
 * 2. FETCH NOTICES
 * URL: GET /api/notices
 * Open to all logged-in users, but the controller will "Filter" 
 * which ones you are allowed to see based on your route/role.
 */
router.get('/', protect, getNotices);

module.exports = router;
