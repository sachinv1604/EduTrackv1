/**
 * Real-Time Tracking Service
 * 
 * This service manages the "Heartbeat" for the entire application.
 * It is a SINGLETON—it holds the timer reference outside of any React components.
 * This guarantees that only one tracking loop can ever run at a time.
 */
import api from './api';
import busService from './busService';
import locationService from './locationService';

// Module-level variables (The "State" of the service)
let locationInterval = null;

const trackingService = {
  /**
   * GET BUS STATUS
   * Fetches the checkpoints, current location, and 'isActive' state.
   */
  getBusStatus: async (busId) => {
    try {
      const response = await api.get(`/tracking/${busId}/status`);
      return response.data;
    } catch (error) {
      console.error('[TrackingService] Error fetching status:', error);
      throw error.response?.data?.message || 'Error fetching real-time status';
    }
  },

  /**
   * START TRACKING (Heartbeat)
   * This handles the 10-second loop for DRIVERS.
   * 
   * @param {string} routeId - The ID of the route to track
   * @param {function} onStatusUpdate - Callback to update the UI with fresh status
   * @param {function} onAuthError - Callback for session expiration
   * @param {function} onLocationUpdate - Callback for local device GPS coordinates
   */
  startTracking: async (routeId, onStatusUpdate, onAuthError, onLocationUpdate) => {
    // 1. CLEANUP FIRST: Kill any zombie timers immediately
    trackingService.stopTracking();

    console.log('[TRACK_SVC] Starting global heartbeat for route:', routeId);

    /**
     * LOOP A: POSITION STREAMING (10s)
     */
    locationInterval = setInterval(async () => {
      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] [TRACK_SVC] Heartbeat Tick...`);
      try {
        // A. Check GPS Hardware
        const gpsEnabled = await locationService.checkLocationEnabled();
        if (!gpsEnabled) return; // Wait for them to turn it on

        // B. Get Coords
        const currentLoc = await locationService.getCurrentLocation();
        if (onLocationUpdate) onLocationUpdate(currentLoc);
        
        // C. Transmit to Cloud
        if (currentLoc.latitude !== 0 && currentLoc.longitude !== 0) {
          // GPS STABILITY CHECK: Ignore pings with poor accuracy (> 100m)
          if (currentLoc.accuracy && currentLoc.accuracy > 100) {
             console.log(`[${now}] [TRACK_SVC] Skipping ping: Poor accuracy (${currentLoc.accuracy.toFixed(0)}m)`);
          } else {
             await busService.updateLocation(routeId, currentLoc.latitude, currentLoc.longitude, currentLoc.accuracy);
             console.log(`[${now}] [TRACK_SVC] Ping Success: ${currentLoc.latitude.toFixed(4)}, ${currentLoc.longitude.toFixed(4)} (Acc: ${currentLoc.accuracy?.toFixed(0)}m)`);
          }
        } else {
          console.log(`[${now}] [TRACK_SVC] Skipping ping: GPS still locking...`);
        }
        
        // D. Trigger UI update
        if (onStatusUpdate) {
          const busStatus = await trackingService.getBusStatus(routeId);
          onStatusUpdate(busStatus);
        }
      } catch (error) {
        const errorStr = error.toString();
        // If the server says "Trip is not active", we must kill the service immediately
        if (errorStr.includes('Trip is not active')) {
           console.log('[TRACK_SVC] Server reports INACTIVE. Killing heartbeat.');
           trackingService.stopTracking();
           if (onStatusUpdate) onStatusUpdate(null);
        }
        if (errorStr.includes('401') && onAuthError) onAuthError(error);
      }
    }, 10000);
  },

  /**
   * STOP TRACKING (The Kill Switch)
   * Absolute guarantee that the background timers are cleared.
   */
  stopTracking: () => {
    console.log('[TRACK_SVC] Global Heartbeat Stopped.');
    if (locationInterval) clearInterval(locationInterval);
    locationInterval = null;
  }
};

export default trackingService;
