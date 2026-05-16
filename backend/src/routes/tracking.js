const express = require('express');
const router = express.Router();
const { getBusStatus } = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');

// GET /api/tracking/:busId/status - Protected (needs user context for role check)
router.get('/:busId/status', protect, getBusStatus);

module.exports = router;
