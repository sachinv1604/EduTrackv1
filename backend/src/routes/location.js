/**
 * Location Routes
 * 
 * Handles real-time data: GPS location updates and Setup Mode triggers.
 */
const express = require('express');
const router = express.Router();
const { 
  updateLocation, 
  markCheckpoint, 
  resetSetupMode, 
  addCheckpoint, 
  finishSetup,
  clearCheckpoints,
  deleteCheckpoint,
  manualArrival
} = require('../controllers/locationController');
const { protect, roleCheck } = require('../middleware/auth');

/**
 * 1. LIVE GPS UPDATE
 * URL: POST /api/location
 * Only allow authenticated Drivers to send their location.
 */
router.post('/', protect, roleCheck(['driver']), updateLocation);

/**
 * 2. SETUP MODE: MARK PHYSICAL CHECKPOINT
 * URL: POST /api/location/mark
 * Driver clicks this when physically standing at a new stop.
 */
router.post('/mark', protect, roleCheck(['driver']), markCheckpoint);

/**
 * 3. SETUP MODE: ADD CHECKPOINT (Text/JSON)
 * URL: POST /api/location/add
 * Manually add a stop to the route during setup.
 */
router.post('/add', protect, roleCheck(['driver']), addCheckpoint);

/**
 * 4. SETUP MODE: FINALIZE
 * URL: POST /api/location/finish-setup
 * Closes the editing mode for the route and saves final stops.
 */
router.post('/finish-setup', protect, roleCheck(['driver']), finishSetup);

/**
 * 5. SETUP MODE: CLEAR ALL
 * URL: POST /api/location/clear
 */
router.post('/clear', protect, roleCheck(['driver']), clearCheckpoints);

/**
 * 6. SETUP MODE: DELETE SINGLE
 * URL: POST /api/location/delete-checkpoint
 */
router.post('/delete-checkpoint', protect, roleCheck(['driver']), deleteCheckpoint);

/**
 * 7. LIVE TRACKING: MANUAL ARRIVAL
 * URL: POST /api/location/manual-arrival
 */
router.post('/manual-arrival', protect, roleCheck(['driver']), manualArrival);

/**
 * 8. RESET SETUP (EMERGENCY/ADMIN)
 * URL: POST /api/location/reset-setup
 * Only an Admin can "Unlock" a route to let a driver re-do the setup.
 */
router.post('/reset-setup', protect, roleCheck(['admin']), resetSetupMode);

module.exports = router;
