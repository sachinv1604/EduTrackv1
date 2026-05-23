/**
 * Location Controller
 * 
 * This is the "Brain" of the tracking system. It processes GPS coordinates
 * sent from the Driver's phone and decides if the bus has arrived at or 
 * departed from a stop.
 */
const mongoose = require('mongoose');
const Route = require('../models/Route');
const CheckpointLog = require('../models/CheckpointLog');
const User = require('../models/User');
const { getDistanceFromLatLonInMeters } = require('../utils/distance');
const fcm = require('../utils/fcm');

// --- PROXIMITY CONSTANTS ---
// ARRIVAL: 60m (Safe buffer for mobile GPS drift, optimized in v3)
// DEPARTURE: 60m 
const ARRIVAL_THRESHOLD = 60; 
const DEPARTURE_THRESHOLD = 60; 

/**
 * @desc    Update bus location and process checkpoint logic
 * @route   POST /api/location
 * @access  Private (Driver)
 * 
 * This function is called every ~10 seconds by the Driver's app.
 */
const updateLocation = async (req, res) => {
  try {
    // 1. DATA EXTRACTION (Smart Detection)
    // Fix: We must check for undefined/null because latitude can be 0.0
    const busId = req.body.busId;
    const lat = req.body.lat !== undefined ? req.body.lat : (req.body.latitude !== undefined ? req.body.latitude : req.body.LAT);
    const lng = req.body.lng !== undefined ? req.body.lng : (req.body.longitude !== undefined ? req.body.longitude : req.body.LNG);
    const accuracy = req.body.accuracy;

    const now = new Date().toLocaleTimeString();
    console.log(`\n[${now}] [PAYLOAD] [${busId}] Coords: ${lat}, ${lng} | Acc: ${accuracy}m`);

    if (!busId || lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'GPS data is incomplete' });
    }

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return res.status(400).json({ message: 'Invalid Route ID' });
    }

    // GPS VALIDATION: Ignore [0,0] pings from phones that haven't locked yet.
    if (lat === 0 && lng === 0) {
      console.log(`[${now}] [WARN] [${busId}] Ignoring [0,0] ping (No GPS Lock).`);
      return res.status(400).json({ message: 'Invalid GPS lock. Please wait.' });
    }

    // 2. Fetch the Route
    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });
    
    // 3. TELEMETRY LOG
    const routeReg = route.registrationNo || 'NO-REG';
    console.log(`[${now}] [TRACE] [${routeReg}] Ping | Active: ${route.isActive} | Setup: ${route.setupMode}`);
    console.log(`[${now}] [PING] [${routeReg}] Driver: ${req.user.name} | Coords: [${lat}, ${lng}]`);

    if (!route.isActive) return res.status(400).json({ message: 'Trip is not active.' });

    // UPDATE CURRENT STATE
    route.currentLocation = { type: 'Point', coordinates: [lng, lat] };
    route.lastLocationUpdate = Date.now();

    /**
     * --- SMART TRACKING ENGINE (V3) ---
     */
    if (!route.setupMode && route.checkpoints && route.checkpoints.length > 0) {
      let nextCPIndex = route.lastDepartedCheckpointIndex + 1;
      
      // Look ahead to find which stop we are currently near
      // CIRCULAR ROUTE FIX: We take the FIRST match to prevent jumping from start to end immediately.
      let matchingIndex = -1;
      for (let i = nextCPIndex; i < route.checkpoints.length; i++) {
        const cp = route.checkpoints[i];
        const [cpLng, cpLat] = cp.location.coordinates;
        
        // ZERO-POINT PROTECTION: If the stop was saved as [0,0], skip it to avoid 8-million-meter bugs.
        if (cpLat === 0 && cpLng === 0) {
          console.log(`[${now}] [WARN] [${routeReg}] Skipping ${cp.name} because it has [0,0] coordinates.`);
          continue;
        }

        const dist = getDistanceFromLatLonInMeters(lat, lng, cpLat, cpLng);
        
        // SMART THRESHOLD: If the phone is inaccurate (e.g. 200m drift), 
        // we relax the threshold to match the reported accuracy, up to a max of 250m.
        const dynamicThreshold = Math.min(Math.max(ARRIVAL_THRESHOLD, accuracy || 0), 250);
        
        console.log(`[${now}] [DIST] [${routeReg}] Checking ${cp.name}: ${Math.round(dist)}m | CP: [${cpLat}, ${cpLng}] | Threshold: ${dynamicThreshold}m`);

        if (dist < dynamicThreshold) {
          matchingIndex = i;
          // DO NOT BREAK: Find the furthest stop reached in the sequence (Leap Logic)
        } else {
          // If we are not at stop i, we definitely cannot be at stop i+1
          break;
        }
      }

      // 1. ARRIVAL / TRANSITION
      if (matchingIndex !== -1) {
        /**
         * SUB-CASE: CATCH-UP LOGIC
         */
        if (matchingIndex > nextCPIndex) {
          console.log(`[${now}] [BREAKTHROUGH] [${routeReg}] Skipping ${matchingIndex - nextCPIndex} stops.`);
          
          for (let j = nextCPIndex; j < matchingIndex; j++) {
            const skippedCP = route.checkpoints[j];
            await CheckpointLog.create({
              busId: route._id,
              checkpointIndex: j,
              checkpointName: skippedCP.name,
              arrivalTime: Date.now(),
              departureTime: Date.now()
            });
          }
          route.lastDepartedCheckpointIndex = matchingIndex - 1;
        }

        const targetCP = route.checkpoints[matchingIndex];
        const isAlreadyAtThisStop = route.arrivedAtCheckpoint && (route.lastDepartedCheckpointIndex + 1 === matchingIndex);

        if (!isAlreadyAtThisStop) {
          route.arrivedAtCheckpoint = true;
          await CheckpointLog.create({
            busId: route._id,
            checkpointIndex: matchingIndex,
            checkpointName: targetCP.name,
            arrivalTime: Date.now()
          });
          console.log(`[${now}] [LOG] [${routeReg}] NEW ARRIVAL at ${targetCP.name}`);
        }
        nextCPIndex = matchingIndex;
      }
      
      /**
       * 2. DEPARTURE LOGIC
       */
      if (route.arrivedAtCheckpoint && nextCPIndex < route.checkpoints.length) {
        const currentCP = route.checkpoints[nextCPIndex];
        const [cpLng, cpLat] = currentCP.location.coordinates;
        const dist = getDistanceFromLatLonInMeters(lat, lng, cpLat, cpLng);
        const dynamicDepartureThreshold = Math.min(Math.max(DEPARTURE_THRESHOLD, (accuracy || 0) + 20), 300);

        if (dist > dynamicDepartureThreshold) {
          route.arrivedAtCheckpoint = false;
          route.lastDepartedCheckpointIndex = nextCPIndex;

          await CheckpointLog.findOneAndUpdate(
            { busId: route._id, checkpointIndex: nextCPIndex, departureTime: null },
            { departureTime: Date.now() },
            { sort: { createdAt: -1 } }
          );

          console.log(`[${now}] [LOG] [${routeReg}] DEPARTED from ${currentCP.name}`);
          sendDepartureNotifications(route, currentCP.name);

          // Auto trip end when the bus departs the last checkpoint
          if (nextCPIndex === route.checkpoints.length - 1) {
            route.isActive = false;
            console.log(`[AUTO-END] [${routeReg}] Trip ended automatically after departing the final checkpoint: ${currentCP.name}`);
          }
        }
      }

      /**
       * 3. ETA CALCULATION
       */
      const etaIdx = route.arrivedAtCheckpoint 
        ? route.lastDepartedCheckpointIndex + 2 
        : route.lastDepartedCheckpointIndex + 1;
        
      if (etaIdx < route.checkpoints.length) {
        const nextCP = route.checkpoints[etaIdx];
        const [nLng, nLat] = nextCP.location.coordinates;
        
        // SANITY CHECK: Don't calculate ETA to [0,0]
        if (nLat === 0 && nLng === 0) {
          route.nextCheckpointDistance = 0;
          route.nextCheckpointETA = 0;
        } else {
          const dNext = getDistanceFromLatLonInMeters(lat, lng, nLat, nLng);
          route.nextCheckpointDistance = Math.round(dNext);
          route.nextCheckpointETA = Math.ceil(dNext / 500); // 30 km/h
        }

        console.log(`[${now}] [ETA] [${routeReg}] Next: ${nextCP.name} | ${route.nextCheckpointDistance}m | Est: ${route.nextCheckpointETA} mins`);
      } else {
        route.nextCheckpointETA = 0;
        route.nextCheckpointDistance = 0;
      }
    }
  
    await route.save();
    res.status(200).json({ message: 'Location updated', arrivedAtCheckpoint: route.arrivedAtCheckpoint });

  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * Helper to trigger Push Notifications
 * Calls the FCM utility to alert students and coordinators.
 */
const sendDepartureNotifications = async (route, checkpointName) => {
  try {
    console.log(`[NOTIFICATION] Alerting subscribers for Route ${route.registrationNo} - Departed from ${checkpointName}`);
    // Call the high-level FCM utility to find subscribers and dispatch batch notifications
    await fcm.sendDepartureNotifications(route, checkpointName);
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
};

/**
 * SETUP MODE: Mark Checkpoint
 * When a driver is first setting up a route, they drive to each stop 
 * and click a button. This function saves those "calibrated" coordinates.
 */
const markCheckpoint = async (req, res) => {
  try {
    const { busId, checkpointIndex } = req.body;
    const lat = req.body.lat !== undefined ? req.body.lat : (req.body.latitude !== undefined ? req.body.latitude : req.body.LAT);
    const lng = req.body.lng !== undefined ? req.body.lng : (req.body.longitude !== undefined ? req.body.longitude : req.body.LNG);

    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    if (!route.setupMode) {
      return res.status(400).json({ message: 'Route is not in setup mode' });
    }

    // DATA SANITIZATION
    if (lat === 0 && lng === 0) {
      return res.status(400).json({ message: 'Cannot mark stop at [0,0]. Wait for GPS lock.' });
    }

    // Update the location array
    route.checkpoints[checkpointIndex].location = {
      type: 'Point',
      coordinates: [lng, lat]
    };

    /**
     * AUTO-EXIT SETUP MODE
     */
    const allMarked = route.checkpoints.every(cp => 
      cp.location && 
      cp.location.coordinates && 
      cp.location.coordinates[0] !== 0 && 
      cp.location.coordinates[1] !== 0
    );

    if (allMarked) {
      route.setupMode = false;
    }

    await route.save();
    console.log(`[SETUP] [${route.registrationNo}] MARKED stop ${checkpointIndex} at [${lat}, ${lng}]`);

    res.status(200).json({ 
      message: 'Checkpoint marked successfully', 
      setupMode: route.setupMode,
      allMarked,
      route // Added route to sync frontend state
    });

  } catch (error) {
    console.error('Error marking checkpoint:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * SETUP MODE: Add Checkpoint
 */
const addCheckpoint = async (req, res) => {
  try {
    const { busId, name } = req.body;
    const lat = req.body.lat !== undefined ? req.body.lat : (req.body.latitude !== undefined ? req.body.latitude : req.body.LAT);
    const lng = req.body.lng !== undefined ? req.body.lng : (req.body.longitude !== undefined ? req.body.longitude : req.body.LNG);

    // 1. GPS Sanitization
    if (lat === undefined || lng === undefined || (lat === 0 && lng === 0)) {
      return res.status(400).json({ message: 'Invalid GPS. Wait for location lock (check the new GPS readout on your screen).' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Stop name is required' });
    }

    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    if (!route.setupMode) {
      return res.status(400).json({ message: 'Route is not in setup mode' });
    }

    // 2. Append a new stop with ACTUAL coordinates [lng, lat]
    route.checkpoints.push({
      order: route.checkpoints.length,
      name,
      location: { 
        type: 'Point', 
        coordinates: [lng, lat] 
      }
    });

    await route.save();
    console.log(`[SETUP] [${route.registrationNo}] Added ${name} at [${lat}, ${lng}]`);
    
    res.status(200).json({ 
      message: 'Checkpoint added successfully', 
      checkpoints: route.checkpoints,
      route // Include route to update frontend state
    });

  } catch (error) {
    console.error('[SETUP_ADD_ERR]', error);
    res.status(500).json({ message: 'Error adding checkpoint', error: error.message });
  }
};

/**
 * SETUP MODE: Finish Setup
 * 
 * Manually closes the setup mode, allowing tracking to begin even if 
 * not all stops are marked (though marking all is recommended).
 */
const finishSetup = async (req, res) => {
  try {
    const { busId } = req.body;

    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    route.setupMode = false;
    await route.save();

    res.status(200).json({ message: 'Setup finalized!', setupMode: false });

  } catch (error) {
    console.error('[SETUP_FINISH_ERR]', error);
    res.status(500).json({ message: 'Error finalizing setup', error: error.message });
  }
};

/**
 * ADMIN: Reset Setup Mode
 * 
 * Allows an admin to "Unlock" a route so the driver can re-calibrate the 
 * physical stop coordinates if they were marked incorrectly.
 */
const resetSetupMode = async (req, res) => {
  try {
    const { busId } = req.params;

    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    route.setupMode = true;
    await route.save();

    res.status(200).json({ message: 'Route unlocked for re-setup', setupMode: true });

  } catch (error) {
    console.error('[SETUP_RESET_ERR]', error);
    res.status(500).json({ message: 'Error resetting setup mode', error: error.message });
  }
};

/**
 * SETUP MODE: Clear All Checkpoints
 */
const clearCheckpoints = async (req, res) => {
  try {
    const { busId } = req.body;
    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    route.checkpoints = [];
    route.setupMode = true;
    route.isActive = false;
    await route.save();

    res.status(200).json({ message: 'All checkpoints cleared. Route reset to setup mode.' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing checkpoints', error: error.message });
  }
};

/**
 * SETUP MODE: Delete Single Checkpoint
 */
const deleteCheckpoint = async (req, res) => {
  try {
    const { busId, checkpointIndex } = req.body;
    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    if (checkpointIndex < 0 || checkpointIndex >= route.checkpoints.length) {
      return res.status(400).json({ message: 'Invalid checkpoint index' });
    }

    route.checkpoints.splice(checkpointIndex, 1);
    
    // Re-order remaining checkpoints
    route.checkpoints.forEach((cp, idx) => {
      cp.order = idx;
    });

    await route.save();
    res.status(200).json({ message: 'Checkpoint deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting checkpoint', error: error.message });
  }
};

/**
 * LIVE TRACKING: Manual Arrival Override
 * Forces the route to advance to the next stop.
 */
const manualArrival = async (req, res) => {
  try {
    const { busId } = req.body;
    const route = await Route.findById(busId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    if (route.setupMode) return res.status(400).json({ message: 'Cannot use manual arrival in Setup Mode.' });

    let nextCPIndex = route.lastDepartedCheckpointIndex + 1;
    if (nextCPIndex >= route.checkpoints.length) {
      return res.status(400).json({ message: 'No more stops to arrive at.' });
    }

    const now = new Date();
    
    // 1. If we were already at a stop, we depart it first
    if (route.arrivedAtCheckpoint) {
      // Record departure for the current one
      await CheckpointLog.findOneAndUpdate(
        { busId: route._id, checkpointIndex: nextCPIndex, departureTime: null },
        { departureTime: now }
      );
      
      route.lastDepartedCheckpointIndex = nextCPIndex;
      nextCPIndex++;
      
      if (nextCPIndex >= route.checkpoints.length) {
        route.arrivedAtCheckpoint = false;
        route.isActive = false; // Finish trip
        await route.save();
        return res.status(200).json({ message: 'Trip completed via manual override.' });
      }
    }

    // 2. Mark arrival at the next stop
    route.arrivedAtCheckpoint = true;
    await CheckpointLog.create({
      busId: route._id,
      checkpointIndex: nextCPIndex,
      arrivalTime: now
    });

    await route.save();
    res.status(200).json({ message: `Manual arrival recorded at ${route.checkpoints[nextCPIndex].name}` });
  } catch (error) {
    res.status(500).json({ message: 'Error in manual arrival', error: error.message });
  }
};

module.exports = {
  updateLocation,
  markCheckpoint,
  addCheckpoint,
  finishSetup,
  resetSetupMode,
  clearCheckpoints,
  deleteCheckpoint,
  manualArrival
};
