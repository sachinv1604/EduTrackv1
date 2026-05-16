/**
 * Authentication Routes
 * 
 * Maps URL paths to the logic defined in authController.js.
 */
const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getMe,
  updateMe 
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public: Anyone can try to sign up
// URL: POST /api/auth/register
router.post('/register', registerUser);

// Public: Anyone can try to login
// URL: POST /api/auth/login
router.post('/login', loginUser);

/**
 * Private: Must be logged in (protect)
 * URL: GET /api/auth/me
 * Returns the current user's data based on their JWT.
 */
router.get('/me', protect, getMe);

// Private: Update your own profile
// URL: PUT /api/auth/me
router.put('/me', protect, updateMe);

module.exports = router;
