/**
 * Route Controller
 * 
 * This controller manages the "Geographic" and "Assignment" aspects of the system.
 * It handles creating routes, assigning them to staff, and retrieving 
 * route-specific info like the list of stops (checkpoints).
 */
const Route = require('../models/Route');
const fcm = require('../utils/fcm');

/**
 * @desc    Get all routes with staff info
 * @route   GET /api/routes
 * @access  Public
 */
const getRoutes = async (req, res) => {
  try {
    /**
     * DATA AGGREGATION & OPTIMIZATION
     * .populate() - Fetches full driver/coordinator objects from the Users collection.
     * .lean() - Returning a plain Javascript object instead of a Mongoose Document. 
     * Since we aren't "saving" this data back to the DB here, .lean() is much 
     * faster and uses less memory.
     */
    const routes = await Route.find()
      .populate('driverId', 'name phone email')
      .populate('coordinatorId', 'name phone email')
      .lean(); 
    res.status(200).json(routes);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Get route specifically assigned to the current driver
 */
const getMyRoute = async (req, res) => {
  try {
    const route = await Route.findOne({ driverId: req.user._id });
    if (!route) {
      return res.status(404).json({ message: 'No route assigned to you' });
    }
    res.status(200).json(route);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Get route assigned to current coordinator
 */
const getCoordinatorRoute = async (req, res) => {
  try {
    const route = await Route.findOne({ coordinatorId: req.user._id })
      .populate('driverId', 'name phone email');

    if (!route) {
      return res.status(404).json({ message: 'No route assigned to you' });
    }

    res.status(200).json(route);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Toggle route active status (Start/End Trip)
 * 
 * Why is this repeated in both Bus and Route controllers? 
 * In our system, a 'Bus' and a 'Route' are the same document. Having it in 
 * both places ensures that frontend developers can find the functionality 
 * regardless of whether they are thinking in terms of the "Vehicle" or the "Path".
 */
const toggleTripStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const route = await Route.findById(req.params.id);

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    if (route.driverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to manage this route' });
    }

    route.isActive = isActive;
    
    /**
     * FRESH JOURNEY STATE
     * When starting (isActive=true), we reset:
     * 1. lastDepartedCheckpointIndex = -1 (Ready for Stop 0)
     * 2. arrivedAtCheckpoint = false (We are in motion)
     */
    if (isActive) {
      route.lastDepartedCheckpointIndex = -1;
      route.arrivedAtCheckpoint = false;
      
      // Notify all subscribed students that the trip is starting
      fcm.sendTripStartNotifications(route);
    }

    await route.save();
    res.status(200).json(route);
  } catch (error) {
    res.status(400).json({ message: 'Trip update failed', error: error.message });
  }
};

/**
 * @desc    Create a NEW route
 * @route   POST /api/routes
 * @access  Private (Admin)
 */
const createRoute = async (req, res) => {
  try {
    const { name, checkpoints, estimatedTime, polyline, registrationNo, capacity } = req.body;

    // Create the document with all geographic and bus metadata
    const route = await Route.create({
      name,
      checkpoints,
      estimatedTime,
      polyline,
      registrationNo,
      capacity
    });

    res.status(201).json(route);
  } catch (error) {
    res.status(400).json({ message: 'Invalid data', error: error.message });
  }
};

/**
 * @desc    Update a route's metadata or checkpoints
 */
const updateRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // Returns the updated version
      runValidators: true // Enforces schema rules on the update
    });

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    res.status(200).json(route);
  } catch (error) {
    res.status(400).json({ message: 'Update failed', error: error.message });
  }
};

/**
 * @desc    Permanently delete a route
 */
const deleteRoute = async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    res.status(200).json({ message: 'Route deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Deletion failed', error: error.message });
  }
};

module.exports = {
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getMyRoute,
  getCoordinatorRoute,
  toggleTripStatus
};
