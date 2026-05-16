import * as Location from 'expo-location';

const locationService = {
  requestPermissions: async () => {
    console.log('[GPS] Requesting location permissions...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      console.log(`[GPS] Permission status: ${granted ? 'GRANTED' : 'DENIED'}`);
      return granted;
    } catch (error) {
      console.error('[GPS_ERR] Permission request failed:', error);
      return false;
    }
  },

  checkLocationEnabled: async () => {
    try {
      // Correct function name in expo-location is hasServicesEnabledAsync
      const enabled = await Location.hasServicesEnabledAsync();
      console.log(`[GPS] System Location Services enabled: ${enabled}`);
      return enabled;
    } catch (error) {
      console.error('[GPS_ERR] Service check failed:', error);
      return false;
    }
  },

  getCurrentLocation: async () => {
    console.log('[GPS] Fetching fresh position coordinates...');
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      console.log(`[GPS] Position fixed: ${location.coords.latitude}, ${location.coords.longitude}`);
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
    } catch (error) {
      console.error('[GPS_ERR] Failed to get position:', error);
      throw error;
    }
  }
};

export default locationService;
