/**
 * Fleet & Route Management Routes
 * 
 * Maps URL paths to routeController.js. 
 * Since we unified "Bus" and "Route", these endpoints handle BOTH.
 */
const express = require('express');
const router = express.Router();
const { 
  getRoutes, 
  createRoute, 
  updateRoute, 
  deleteRoute,
  getMyRoute,
  getCoordinatorRoute,
  toggleTripStatus
} = require('../controllers/routeController');
const { protect, roleCheck } = require('../middleware/auth');

// Public: Anyone can see the list of routes/buses
router.get('/', getRoutes);

// Admin Only: Create or Delete a Route document
router.post('/', protect, roleCheck(['admin']), createRoute);
router.delete('/:id', protect, roleCheck(['admin']), deleteRoute);

// Admin & Coordinators: Edit route details or assignment
router.put('/:id', protect, roleCheck(['admin', 'coordinator']), updateRoute);

/**
 * STAFF ENDPOINTS (Drivers & Coordinators)
 * 
 * Note the COMPATIBILITY ALIASES below. 
 * Because the frontend was built when "Bus" and "Route" were separate, 
 * we provide both /my-route and /my-bus so the app doesn't break.
 */
router.get('/my-route', protect, roleCheck(['driver']), getMyRoute);
router.get('/my-bus', protect, roleCheck(['driver']), getMyRoute); // For old code

router.get('/coordinator-route', protect, roleCheck(['coordinator']), getCoordinatorRoute);
router.get('/coordinator-buses', protect, roleCheck(['coordinator']), getCoordinatorRoute); // For old code

// Trigger for the Driver's "Start Trip" button
router.put('/:id/trip', protect, roleCheck(['driver']), toggleTripStatus);

module.exports = router;
