/**
 * Tracking Controller
 * 
 * This is the "Read-Only" side of the tracking system. 
 * While the Location Controller WRITES data (GPS pings), 
 * the Tracking Controller READS it to show the "Route Progress Bar" 
 * and the "Live Map" to Students and Coordinators.
 */
const mongoose = require('mongoose');
const Route = require('../models/Route');
const CheckpointLog = require('../models/CheckpointLog');

/**
 * @desc    Get real-time route/bus status (checkpoints passed/upcoming)
 * @route   GET /api/tracking/:busId/status
 * @access  Public (Anyone can track a public bus)
 */
const getBusStatus = async (req, res) => {
  try {
    let { busId } = req.params; // Note: busId here refers to the Route ID

    // DEFENSIVE CODING: Always validate IDs before querying MongoDB 
    // to prevent "CastError" crashes.
    if (!busId || !mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({ message: 'Invalid Route ID provided' });
    }

    // 1. FETCH THE ROUTE
    const route = await Route.findById(busId);
    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    /**
     * 2. AUTHORIZATION CHECK (PRIVACY)
     * req.user comes from the 'protect' middleware.
     * Use to ensure students/coords only see THEIR bus.
     */
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    if (userRole === 'student') {
      const assigned = req.user.assignedRoute?.toString() || req.user.requestedRoute?.toString();
      if (assigned !== busId) {
        return res.status(403).json({ message: 'Not authorized: This is not your assigned route' });
      }
    } else if (userRole === 'coordinator') {
      if (route.coordinatorId?.toString() !== userId) {
        return res.status(403).json({ message: 'Not authorized: You are not the coordinator for this route' });
      }
    } else if (userRole === 'driver') {
       // Drivers should use the getMyBus/updateLocation flow, not public status
       if (route.driverId?.toString() !== userId) {
         return res.status(403).json({ message: 'Not authorized: This is not your assigned drive.' });
       }
    }
    // Admins are allowed through by default.

    /**
     * 2. FETCH HISTORICAL DATA (The "Journey")
     * We need to know EXACTLY when the bus reached the stops.
     * We fetch logs for this trip, sorted by checkpoint index.
     */
    const logs = await CheckpointLog.find({ busId }).sort({ checkpointIndex: 1 });

    /**
     * 3. DATA MERGING (The "Status Weaver")
     * We loop through the "Static" checkpoints from the Route model and 
     * "weave" in the "Dynamic" data from our logs.
     * 
     * Why? 
     * The Route model only knows WHAT the stops are. 
     * The Logs know WHEN the bus was at those stops.
     */
    const checkpoints = route.checkpoints.map((cp, index) => {
      // Comparison: Is the bus currently at or past this stop?
      const isPassed = index <= route.lastDepartedCheckpointIndex;
      
      // Find the specific timestamp for this stop from our logs
      const logEntry = logs.find(log => log.checkpointIndex === index);

      return {
        name: cp.name,
        status: isPassed ? 'passed' : 'upcoming',
        setupMode: route.setupMode,
        // If passed, we show the departure time; otherwise null
        departureTime: (isPassed && logEntry) ? logEntry.departureTime : null,
        location: cp.location
      };
    });

    /**
     * 4. FINAL PROGRESS OBJECT
     * We send a "Unified Status" object. 
     * The frontend uses this one object to draw the Map dot, the Progress bar, 
     * and the "Active/Offline" status badge.
     */
    res.status(200).json({
      busId: route._id,
      registrationNo: route.registrationNo,
      routeName: route.name,
      isActive: route.isActive,
      setupMode: route.setupMode,
      arrivedAtCheckpoint: route.arrivedAtCheckpoint,
      lastDepartedCheckpointIndex: route.lastDepartedCheckpointIndex,
      nextCheckpointETA: route.nextCheckpointETA,
      nextCheckpointDistance: route.nextCheckpointDistance,
      currentLocation: route.currentLocation,
      checkpoints
    });

  } catch (error) {
    console.error('[TRACKING_READ_ERR]', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  getBusStatus
};
