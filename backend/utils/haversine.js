/**
 * Haversine Distance Calculator
 * ------------------------------
 * Calculates the great-circle distance between two points on Earth
 * using the Haversine formula. Returns distance in meters.
 *
 * Reference: https://en.wikipedia.org/wiki/Haversine_formula
 */

import { GPS } from "../config/constants.js";

/**
 * Convert degrees to radians.
 * @param {number} deg - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two GPS coordinates.
 *
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in meters
 *
 * @example
 *   calculateDistance(28.6139, 77.2090, 19.0760, 72.8777)
 *   // → ~1,150,000 meters (Delhi to Mumbai)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Return distance in meters (radius is in km, so multiply by 1000)
  return GPS.EARTH_RADIUS_KM * c * 1000;
}

/**
 * Calculate distance in kilometers (convenience wrapper).
 *
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  return calculateDistance(lat1, lon1, lat2, lon2) / 1000;
}
