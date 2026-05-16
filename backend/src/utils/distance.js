/**
 * GPS Distance Calculation (Haversine Formula)
 * 
 * WHY DO WE NEED THIS? 
 * The Earth is not a flat map; it's a sphere (roughly). Therefore, we cannot 
 * use the simple Pythagorean theorem (a² + b² = c²) to find the distance 
 * between two coordinates. 
 * 
 * We must use the "Haversine Formula", which accounts for the curvature 
 * of the Earth. This ensures that when the bus is 45 meters from a stop, 
 * our system calculates exactly 45 meters, not a distorted flat-map distance.
 * 
 * @param {number} lat1 - Latitude of Point A
 * @param {number} lon1 - Longitude of Point A
 * @param {number} lat2 - Latitude of Point B
 * @param {number} lon2 - Longitude of Point B
 * @returns {number} - Straight-line distance in METERS
 */
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  // R is the Earth's radius in meters. We use 6,371 km as the average.
  const R = 6371000; 
  
  /**
   * 1. CONVERSION TO RADIANS
   * Computers and Math functions (Math.sin, Math.cos) work in "Radians", 
   * not the 360-degree units we see on GPS. 
   * Formula: Radians = Degrees * (PI / 180)
   */
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  /**
   * 2. THE CHORD LENGTH (a)
   * This is part of the geometry that represents the square of half the 
   * straight-line distance through the Earth between the two points.
   */
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  /**
   * 3. THE ANGULAR DISTANCE (c)
   * We use the inverse tangent (atan2) to find the central angle 
   * between the two points in radians.
   */
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  /**
   * 4. FINAL MAPPING
   * We multiply the Earth's radius (R) by the angle (c) to get the 
   * actual distance in meters.
   */
  const distance = R * c; 
  
  return distance;
};

/**
 * Helper: Simple conversion utility for radians.
 */
const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

module.exports = {
  getDistanceFromLatLonInMeters
};
