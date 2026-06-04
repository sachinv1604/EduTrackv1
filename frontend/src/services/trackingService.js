/**
 * Real-Time Tracking Service
 * 
 * This service manages the "Heartbeat" for the entire application.
 * It handles both:
 * 1. PERSISTENT WATCHER (Foreground): Using watchPositionAsync for real-time high accuracy.
 * 2. BACKGROUND TASK (Background): Native background location tracking using TaskManager so updates stream when app is minimized.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import api from './api';
import busService from './busService';
import locationService from './locationService';
import { COLORS } from '../theme/colors';

// Global background task name
const BACKGROUND_TRACKING_TASK = 'BACKGROUND-BUS-TRACKING-TASK';

// Module-level variables (The "State" of the active trackers)
let locationInterval = null;
let positionSubscription = null;

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
   * This handles high-accuracy foreground and background location streaming for DRIVERS.
   * Updates occur at a highly responsive 6-second interval (optimized in v3).
   * 
   * @param {string} routeId - The ID of the route to track
   * @param {function} onStatusUpdate - Callback to update the UI with fresh status
   * @param {function} onAuthError - Callback for session expiration
   * @param {function} onLocationUpdate - Callback for local device GPS coordinates
   */
  startTracking: async (routeId, onStatusUpdate, onAuthError, onLocationUpdate) => {
    // 1. CLEANUP FIRST: Kill any zombie trackers immediately
    await trackingService.stopTracking();

    console.log('[TRACK_SVC] Starting global heartbeat and background service for route:', routeId);

    // Save active routeId to AsyncStorage so background task has access to it
    await AsyncStorage.setItem('active_tracking_route_id', routeId);

    try {
      // A. Check GPS Hardware
      const gpsEnabled = await locationService.checkLocationEnabled();
      if (!gpsEnabled) return; // Wait for them to turn it on

      // B. Start background location updates (natively runs foreground service with system notification)
      // This guarantees that location updates keep streaming even if driver closes the app/locks screen!
      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 6000, // Update every 6 seconds as requested
        distanceInterval: 5, // Or when user moves 5 meters
        foregroundService: {
          notificationTitle: "EduTrack Live Tracking Active",
          notificationBody: "EduTrack is tracking and streaming shuttle GPS in the background.",
          notificationColor: COLORS?.primary || "#1E3A8A",
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      }).catch(err => {
        console.warn('[TRACK_SVC] Background location start failed, fallback to foreground only:', err);
      });

      // C. Start foreground high-accuracy persistent watcher
      positionSubscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 6000, // Every 6 seconds
        distanceInterval: 5,
      }, async (location) => {
        const now = new Date().toLocaleTimeString();
        const currentLoc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
        };

        if (onLocationUpdate) onLocationUpdate(currentLoc);

        if (currentLoc.latitude !== 0 && currentLoc.longitude !== 0) {
          // GPS STABILITY CHECK: Ignore pings with poor accuracy (> 100m)
          if (currentLoc.accuracy && currentLoc.accuracy > 100) {
            console.log(`[${now}] [TRACK_SVC] Skipping foreground ping: Poor accuracy (${currentLoc.accuracy.toFixed(0)}m)`);
          } else {
            try {
              await busService.updateLocation(routeId, currentLoc.latitude, currentLoc.longitude, currentLoc.accuracy);
              console.log(`[${now}] [TRACK_SVC] Foreground Ping Success: ${currentLoc.latitude.toFixed(4)}, ${currentLoc.longitude.toFixed(4)} (Acc: ${currentLoc.accuracy?.toFixed(0)}m)`);
            } catch (err) {
              const errorStr = err.toString();
              if (errorStr.includes('Trip is not active')) {
                console.log('[TRACK_SVC] Server reports trip INACTIVE. Stopping trackers.');
                await trackingService.stopTracking();
                if (onStatusUpdate) onStatusUpdate(null);
              }
              if (errorStr.includes('401') && onAuthError) onAuthError(err);
            }
          }
        }
      });

      // D. Periodic Status Polling (Every 6 seconds) to fetch updated checkpoints/ETA progress from backend for driver UI
      locationInterval = setInterval(async () => {
        try {
          if (onStatusUpdate) {
            const busStatus = await trackingService.getBusStatus(routeId);
            onStatusUpdate(busStatus);
          }
        } catch (error) {
          const errorStr = error.toString();
          if (errorStr.includes('401') && onAuthError) onAuthError(error);
        }
      }, 6000);

    } catch (error) {
      console.error('[TRACK_SVC] Error starting tracking engine:', error);
    }
  },

  /**
   * STOP TRACKING (The Kill Switch)
   * Absolute guarantee that both background and foreground timers/watchers are cleared.
   */
  stopTracking: async () => {
    console.log('[TRACK_SVC] Global Heartbeat Stopped.');
    
    // Clear status interval
    if (locationInterval) clearInterval(locationInterval);
    locationInterval = null;

    // Remove foreground watcher subscription
    if (positionSubscription) {
      positionSubscription.remove();
      positionSubscription = null;
    }

    // Stop native background location tracking
    await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});

    // Clear active route in storage
    await AsyncStorage.removeItem('active_tracking_route_id');
  }
};

/**
 * TaskManager Background location task definition.
 * Natively called by the iOS/Android operating system background service.
 */
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BG_TRACK_TASK] Task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] [BG_TRACK_TASK] Background Location Tick:`, location.coords.latitude, location.coords.longitude);
      
      try {
        const routeId = await AsyncStorage.getItem('active_tracking_route_id');
        if (routeId) {
          if (location.coords.accuracy && location.coords.accuracy > 100) {
            console.log(`[BG_TRACK_TASK] Skipping background ping: Poor accuracy (${location.coords.accuracy.toFixed(0)}m)`);
            return;
          }

          // Transmit background coordinates to backend
          await busService.updateLocation(
            routeId,
            location.coords.latitude,
            location.coords.longitude,
            location.coords.accuracy
          );
          console.log('[BG_TRACK_TASK] Background location uploaded successfully');
        } else {
          console.log('[BG_TRACK_TASK] No active routeId found in AsyncStorage. Stopping background updates.');
          await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
        }
      } catch (err) {
        console.error('[BG_TRACK_TASK] Upload failed:', err.message || err);
      }
    }
  }
});

export default trackingService;
