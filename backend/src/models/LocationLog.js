/**
 * LocationLog Model
 * 
 * This is the "Raw GPS Breadcrumbs" collection. 
 * Every 10-15 seconds, the Driver's app sends a ping. We save it here 
 * to create a detailed map of the exact path the bus took.
 * 
 * WHY DO WE NEED THIS?
 * 1. Audit Trail: If a student/parent complains the bus didn't take the 
 *    correct route, we can pull these logs.
 * 2. Playback: In the future, we could "Replay" the bus movement 
 *    on the map using this data.
 */
const mongoose = require('mongoose');

const locationLogSchema = new mongoose.Schema({
  // Link to the journey (Route/Bus) being tracked.
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route', 
    required: [true, 'Bus ID is required for location log']
  },
  // High-precision latitude from the phone GPS sensor.
  latitude: {
    type: Number,
    required: [true, 'Latitude is required']
  },
  // High-precision longitude from the phone GPS sensor.
  longitude: {
    type: Number,
    required: [true, 'Longitude is required']
  },
  // The moment the ping was recorded by the server.
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 604800 // TTL Index: Auto-delete logs older than 7 days (7*24*60*60s)
  }
});

/**
 * ARCHITECTURE TIP: Scaling for 1,000+ Buses
 * 
 * Because this collection gets a new record every 10 seconds per bus, 
 * it will grow to MILLIONS of records very quickly.
 * 
 * In a professional environment, you would:
 * 1. Use TTL (Time To Live) indexes to auto-delete logs older than 7 days.
 * 2. Use MongoDB "Time Series" collections for better compression.
 * 3. Move older logs to a "Cold Storage" like AWS S3.
 */

module.exports = mongoose.model('LocationLog', locationLogSchema);
