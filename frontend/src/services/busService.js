/**
 * Bus & Tracking Service
 * 
 * This is the most "Active" service. It handles the real-time movement 
 * of the bus and the configuration (Setup Mode) of the stops.
 */
import api from './api';

const busService = {
  /**
   * Get the bus assigned to the current Driver
   */
  getMyBus: async () => {
    try {
      const response = await api.get('/buses/my-bus');
      return response.data;
    } catch (error) {
      if (!error.response) {
        throw 'Cannot connect to server. Check your network.';
      }
      const msg = error.response?.data?.message || 'Unknown server error';
      const status = error.response?.status || '???';
      throw `[${status}] ${msg}`;
    }
  },

  /**
   * Get buses assigned to a Coordinator
   */
  getCoordinatorBuses: async () => {
    try {
      const response = await api.get('/buses/coordinator-buses');
      return response.data;
    } catch (error) {
      if (!error.response) {
        throw 'Cannot connect to server. Check your network.';
      }
      const msg = error.response?.data?.message || 'Unknown server error';
      const status = error.response?.status || '???';
      throw `[${status}] ${msg}`;
    }
  },

  /**
   * START / STOP Trip
   * Tells the server the driver has started their journey.
   */
  toggleTrip: async (busId, isActive) => {
    try {
      const response = await api.put(`/buses/${busId}/trip`, { isActive });
      return response.data;
    } catch (error) {
      if (!error.response) {
        throw 'Cannot connect to server. Check your network.';
      }
      const msg = error.response?.data?.message || 'Unknown server error';
      const status = error.response?.status || '???';
      throw `[${status}] ${msg}`;
    }
  },

  /**
   * SEND GPS PING
   * Sends the current latitude and longitude to the server.
   * 
   * IMPORTANT: The server will REJECT this if the trip is not active.
   */
  updateLocation: async (busId, lat, lng, accuracy) => {
    try {
      const response = await api.post('/location', { busId, lat, lng, accuracy });
      return response.data;
    } catch (error) {
      console.error('[BusService] Error updating location:', error);
      if (!error.response) {
        throw 'Cannot connect to server. Check your network.';
      }
      const msg = error.response?.data?.message || 'Unknown server error';
      const status = error.response?.status || '???';
      
      /**
       * CRITICAL SYNC:
       * If the server says "Trip is not active", we must tell the UI 
       * so the driver can see they need to press "Start Trip" again.
       */
      if (status === 400 && msg.includes('Trip is not active')) {
        throw msg;
      }
      
      throw `[${status}] ${msg}`;
    }
  },

  /**
   * SETUP MODE: Mark an existing checkpoint
   * Calibration: Used when a driver is physically at a pre-defined stop 
   * and wants to save its exact GPS coordinate.
   */
  markCheckpoint: async (busId, checkpointIndex, lat, lng) => {
    try {
      const { data } = await api.post('/location/mark', { busId, checkpointIndex, lat, lng });
      return data;
    } catch (error) {
      throw error.response?.data?.message || 'Error marking stop';
    }
  },

  /**
   * SETUP MODE: Add a new checkpoint from scratch
   * Used during the very first run of a new route.
   */
  addCheckpoint: async (busId, name, lat, lng) => {
    const { data } = await api.post('/location/add', { busId, name, lat, lng });
    return data;
  },

  /**
   * SETUP MODE: Finalize
   * Tells the server to lock the route and turn off "Setup Mode".
   */
  finishSetup: async (busId) => {
    const { data } = await api.post('/location/finish-setup', { busId });
    return data;
  },

  clearCheckpoints: async (busId) => {
    const { data } = await api.post('/location/clear', { busId });
    return data;
  },

  deleteCheckpoint: async (busId, checkpointIndex) => {
    const { data } = await api.post('/location/delete-checkpoint', { busId, checkpointIndex });
    return data;
  },

  manualArrival: async (busId) => {
    const { data } = await api.post('/location/manual-arrival', { busId });
    return data;
  },

  /**
   * ADMIN: Reset Setup Mode
   * Allows an admin to unlock a route if the driver made a mistake in setup.
   */
  resetSetup: async (routeId) => {
    const { data } = await api.post('/location/reset-setup', { routeId });
    return data;
  },

  // Fleet Management (Admin Only)
  getAllBuses: async () => {
    try {
      const response = await api.get('/buses');
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || 'Error fetching all buses';
    }
  },

  createBus: async (busData) => {
    try {
      const response = await api.post('/buses', busData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || 'Error creating bus';
    }
  },

  updateBus: async (busId, busData) => {
    try {
      const response = await api.put(`/buses/${busId}`, busData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || 'Error updating bus';
    }
  },

  /**
   * RESET CHECKPOINTS
   * Driver command to safely wipe their route and start from scratch.
   */
  resetCheckpoints: async (busId) => {
    try {
      const response = await api.post(`/buses/${busId}/reset-checkpoints`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || 'Error resetting checkpoints';
    }
  },

  /**
   * Set daily trip start time
   */
  updateStartTime: async (busId, dailyStartTime) => {
    try {
      const response = await api.put(`/buses/${busId}/start-time`, { dailyStartTime });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || 'Error updating start time';
    }
  }
};

export default busService;
