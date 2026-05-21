/**
 * Bus Controller
 * 
 * This controller handles the lifecycle of a physical bus and its connection 
 * to a route.
 * 
 * NOTE: We use the "Route" model here because we unified "Bus" and "Route" into 
 * one single database collection. This makes it easier to track which bus 
 * belongs to which route and who is driving it.
 */
const Bus = require('../models/Route'); 
const fcm = require('../utils/fcm');

/**
 * @desc    Get all buses in the fleet
 * @route   GET /api/buses
 * @access  Public (Anyone can see the list of buses)
 */
const getBuses = async (req, res) => {
  try {
    /**
     * DATA AGGREGATION (.populate)
     * In MongoDB, we only store the "ID" of the driver. 
     * .populate() is a Mongoose feature that looks up those IDs in the "Users" 
     * collection and replaces the ID with the actual driver's name and phone.
     * It's like a "Join" in SQL databases.
     */
    const buses = await Bus.find()
      .populate('driverId', 'name phone email')
      .populate('coordinatorId', 'name phone email');
    res.status(200).json(buses);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Create a new bus entry
 * @route   POST /api/buses
 * @access  Private (Admin only)
 */
const createBus = async (req, res) => {
  try {
    const { name, registrationNo, capacity, driverId, coordinatorId, estimatedTime } = req.body;

    const bus = await Bus.create({
      name,
      registrationNo,
      capacity,
      driverId,
      coordinatorId,
      estimatedTime: estimatedTime || 30
    });

    res.status(201).json(bus);
  } catch (error) {
    res.status(400).json({ message: 'Invalid data', error: error.message });
  }
};

/**
 * @desc    Update bus details (e.g., change the driver)
 * @route   PUT /api/buses/:id
 */
const updateBus = async (req, res) => {
  try {
    /**
     * { new: true } tells Mongoose to return the UPDATED record, not the old one.
     * runValidators ensures the new data follows the Schema rules (like unique: true).
     */
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true 
    });

    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    res.status(200).json(bus);
  } catch (error) {
    res.status(400).json({ message: 'Update failed', error: error.message });
  }
};

/**
 * @desc    Delete a bus from the system
 */
const deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    res.status(200).json({ message: 'Bus deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Deletion failed', error: error.message });
  }
};

/**
 * @desc    Fetch the specific bus assigned to the logged-in Driver
 * @route   GET /api/buses/my-bus
 * @access  Private (Driver only)
 */
const getMyBus = async (req, res) => {
  try {
    // We use the ID from the JWT (req.user._id) to find the assigned bus.
    const bus = await Bus.findOne({ driverId: req.user._id });
    if (!bus) {
      return res.status(404).json({ message: 'No bus assigned to you' });
    }
    res.status(200).json(bus);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Toggle bus active status (Start/End Trip)
 * @route   PUT /api/buses/:id/trip
 * @access  Private (Driver only)
 * 
 * This is arguably the most important function for the Tracking system.
 * It acts as the "On/Off Switch" for real-time tracking.
 */
const toggleTripStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // SECURITY: Ensure the person clicking "Start" is the actual driver.
    if (bus.driverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized: You are not the driver of this bus' });
    }

    bus.isActive = isActive;
    
    // Reset journey state when starting
    if (isActive) {
      bus.lastDepartedCheckpointIndex = -1;
      bus.arrivedAtCheckpoint = false;
      // Notify subscribed students that the trip is starting
      fcm.sendTripStartNotifications(bus);
    }

    await bus.save();
    res.status(200).json(bus);
  } catch (error) {
    res.status(400).json({ message: 'Trip update failed', error: error.message });
  }
};

/**
 * @desc    Get all buses managed by a Coordinator
 * @route   GET /api/buses/coordinator-buses
 */
const getCoordinatorBuses = async (req, res) => {
  try {
    const buses = await Bus.find({ coordinatorId: req.user._id })
      .populate('driverId', 'name phone email');

    if (!buses || buses.length === 0) {
      return res.status(404).json({ message: 'No buses assigned to you' });
    }

    res.status(200).json(buses);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Driver: Clear all checkpoints for the assigned route
 * @route   POST /api/buses/:id/reset-checkpoints
 */
const resetCheckpoints = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);

    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // SECURITY CHECK: Is this the driver assigned to this bus?
    // Admins and Coordinators are also allowed (for help/reset).
    const isOwner = bus.driverId?.toString() === req.user._id.toString();
    const isStaff = ['admin', 'coordinator'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Not authorized: You are not assigned to this bus' });
    }

    // RESET LOGIC
    bus.checkpoints = [];
    bus.lastDepartedCheckpointIndex = -1;
    bus.arrivedAtCheckpoint = false;
    bus.setupMode = true; // Return to setup mode to allow fresh marking

    await bus.save();

    res.status(200).json(bus);
  } catch (error) {
    res.status(400).json({ message: 'Reset failed', error: error.message });
  }
};

module.exports = {
  getBuses,
  createBus,
  updateBus,
  deleteBus,
  getMyBus,
  toggleTripStatus,
  getCoordinatorBuses,
  resetCheckpoints
};
