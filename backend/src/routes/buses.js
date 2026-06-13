const express = require('express');
const router = express.Router();
const { 
  getBuses, 
  createBus, 
  updateBus, 
  deleteBus,
  getMyBus,
  toggleTripStatus,
  getCoordinatorBuses,
  resetCheckpoints,
  updateDailyStartTime
} = require('../controllers/busController');
const { protect, roleCheck } = require('../middleware/auth');

router.get('/', getBuses);
router.post('/', protect, roleCheck(['admin', 'coordinator']), createBus);
router.put('/:id', protect, roleCheck(['admin', 'coordinator']), updateBus);
router.get('/my-bus', protect, roleCheck(['driver']), getMyBus);
router.get('/coordinator-buses', protect, roleCheck(['coordinator']), getCoordinatorBuses);
router.put('/:id/trip', protect, roleCheck(['driver']), toggleTripStatus);
router.put('/:id/start-time', protect, roleCheck(['driver', 'admin', 'coordinator']), updateDailyStartTime);
router.delete('/:id', protect, roleCheck(['admin']), deleteBus);
router.post('/:id/reset-checkpoints', protect, roleCheck(['driver', 'admin', 'coordinator']), resetCheckpoints);

module.exports = router;
