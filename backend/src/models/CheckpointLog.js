/**
 * CheckpointLog Model
 * 
 * This is the "Historical Ledger" of the journey. 
 * While the Route model stores the CURRENT state (Where is the bus NOW?), 
 * the CheckpointLog stores the PAST state (When was the bus at Stop A?).
 * 
 * USE CASES:
 * 1. Accountability: Proving the bus actually visited a stop.
 * 2. Analytics: Calculating how long the bus sits at each stop on average.
 * 3. History: Displaying the "Departed at 8:15 AM" text in the Student UI.
 */
const mongoose = require('mongoose');

const checkpointLogSchema = new mongoose.Schema({
  // The ID of the journey (Route/Bus) being tracked.
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route', 
    required: [true, 'Bus ID is required for logging']
  },
  // The unique position of the stop in the route (0, 1, 2...).
  checkpointIndex: {
    type: Number,
    required: [true, 'Checkpoint index is required']
  },
  /**
   * DATA REDUNDANCY (Denormalization)
   * We store the 'checkpointName' here even though it's already in the Route.
   * Why? 
   * To show history quickly without needing to perform a complex "Join" 
   * (Lookup) on the Route collection every single time.
   */
  checkpointName: {
    type: String,
    required: [true, 'Checkpoint name is required']
  },
  // Set when the bus enters the 50m radius of the stop.
  arrivalTime: {
    type: Date,
    default: null
  },
  // Set when the bus exits the 50m radius of the stop.
  departureTime: {
    type: Date,
    default: null
  }
}, {
  // timestamps: true gives us 'createdAt' (the moment the bus reached the stop radius).
  timestamps: true
});

module.exports = mongoose.model('CheckpointLog', checkpointLogSchema);
