/**
 * Route Model
 * 
 * This is the "Heart" of the system. 
 * While other apps separate "Buses" and "Routes", we unified them 
 * for simplicity. This model stores:
 * 1. Static Info: The registration number, capacity, and name of the route.
 * 2. Geographic Info: All the stops (checkpoints) and their Lat/Lng.
 * 3. Tracking Info: The live GPS location of the bus and its progress.
 */
const mongoose = require('mongoose');

/**
 * Checkpoint Sub-Schema
 * We use a sub-schema because Checkpoints are strictly owned by a Route.
 * They don't have an independent life outside of the route they define.
 */
const checkpointSchema = new mongoose.Schema({
  // The sequence number (0 = Origin, 1 = First Stop, etc.)
  order: {
    type: Number,
    required: [true, 'Checkpoint order is required']
  },
  // The name display for the UI (e.g. "Main Gate Hubli")
  name: {
    type: String,
    required: [true, 'Checkpoint name is required'],
    trim: true
  },
  /**
   * GEOJSON Format
   * MongoDB has specialized storage for maps. 
   * coordinates: [longitude, latitude] 
   * WARNING: For mapping libraries (Google Maps, Leaflet), it is often 
   * [lat, lng]. In MongoDB, it MUST be [lng, lat].
   */
  location: {
    type: {
       type: String,
       enum: ['Point'],
       default: 'Point'
    },
    coordinates: {
       type: [Number],
       required: [true, 'Checkpoint coordinates are required']
    }
  }
});

const routeSchema = new mongoose.Schema({
  // Primary name (e.g. "SDM College - Varur")
  name: {
    type: String,
    required: [true, 'Route name is required'],
    unique: true,
    trim: true
  },
  // The list of checkpoints built using the schema above
  checkpoints: [checkpointSchema],
  
  // High-level estimates for the trip duration
  estimatedTime: {
    type: Number, 
    required: [true, 'Estimated time is required']
  },
  
  // Encoded polyline for drawing the path on the maps
  polyline: {
    type: String,
    required: false, 
    default: ''
  },
  
  // VEHICLE METADATA
  registrationNo: {
    type: String, // e.g. "KA-25-F-0001"
    default: null,
    trim: true
  },
  capacity: {
    type: Number,
    default: 45
  },
  
  // STAKEHOLDERS: Who is responsible for this bus?
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  coordinatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  /**
   * THE "BRAIN" - Real-time State Flags
   * These fields update every 10 seconds as the bus moves.
   */
  
  // The index in the checkpoints array that the bus last LEFT.
  lastDepartedCheckpointIndex: {
    type: Number,
    default: -1 // -1 = The bus hasn't left the first station yet.
  },
  // Controls the "Arrived" vs "Departed" status bubble in the UI.
  arrivedAtCheckpoint: {
    type: Boolean,
    default: false
  },
  // REAL-TIME ETA: Minutes and Meters away from the NEXT stop.
  nextCheckpointETA: {
    type: Number,
    default: 0
  },
  nextCheckpointDistance: {
    type: Number,
    default: 0
  },
  // THE SOURCE OF TRUTH: If false, the bus is considered "Offline".
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Current GPS pin of the vehicle
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  // Timestamp for the "Last updated" text on the UI.
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  },
  
  /**
   * SMART SETUP
   * When a coordinator creates a "New Route", coordinates are often zero.
   * setupMode = true tells the Driver's app to show "Mark Checkpoint" buttons.
   * Once setup, the driver just drives, and everything is automated.
   */
  setupMode: {
    type: Boolean,
    default: true 
  }
}, {
  // Adds "createdAt" and "updatedAt" to every Route document
  timestamps: true
});

/**
 * INDEXING (Performance Optimization)
 * We create a "2dsphere" index.
 * This allows MongoDB to calculate the distance between the Bus and the 
 * Checkpoint in milliseconds, even with thousands of routes!
 */
routeSchema.index({ 'checkpoints.location': '2dsphere' });

module.exports = mongoose.model('Route', routeSchema);
