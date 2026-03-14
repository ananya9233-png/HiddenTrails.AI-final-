/**
 * GPS Validation Utilities
 * -------------------------
 * Provides functions for validating GPS data integrity:
 * - Speed calculation between two GPS points
 * - Teleport detection (impossible jumps)
 * - Speed spike detection (unrealistic velocity)
 * - Proximity validation (user near POI)
 *
 * These are critical for preventing fake photo challenge submissions.
 */

import { calculateDistance, calculateDistanceKm } from "./haversine.js";
import { GPS } from "../config/constants.js";

/**
 * Calculate speed between two GPS points with timestamps.
 *
 * @param {{ latitude: number, longitude: number, timestamp: string|Date }} point1
 * @param {{ latitude: number, longitude: number, timestamp: string|Date }} point2
 * @returns {number} Speed in km/h
 */
export function calculateSpeed(point1, point2) {
  const distanceKm = calculateDistanceKm(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );

  const time1 = new Date(point1.timestamp).getTime();
  const time2 = new Date(point2.timestamp).getTime();
  const timeDiffHours = Math.abs(time2 - time1) / (1000 * 60 * 60);

  // Avoid division by zero — if timestamps are identical, speed is undefined
  if (timeDiffHours === 0) return Infinity;

  return distanceKm / timeDiffHours;
}

/**
 * Detect GPS teleportation — an impossible jump in location.
 * Flags if user moved >20km within a 5-minute window.
 *
 * @param {{ latitude: number, longitude: number, timestamp: string|Date }[]} gpsLogs
 *   Array of GPS entries sorted by timestamp (ascending).
 * @returns {{ detected: boolean, details: string }}
 */
export function detectTeleport(gpsLogs) {
  if (gpsLogs.length < 2) {
    return { detected: false, details: "Insufficient GPS data" };
  }

  for (let i = 1; i < gpsLogs.length; i++) {
    const prev = gpsLogs[i - 1];
    const curr = gpsLogs[i];

    const distanceKm = calculateDistanceKm(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    const timeDiffMinutes =
      Math.abs(new Date(curr.timestamp) - new Date(prev.timestamp)) /
      (1000 * 60);

    // Check: >20km jump within 5 minutes is physically impossible
    if (
      distanceKm > GPS.TELEPORT_DISTANCE_KM &&
      timeDiffMinutes <= GPS.TELEPORT_WINDOW_MINUTES
    ) {
      return {
        detected: true,
        details: `Teleport detected: ${distanceKm.toFixed(1)}km jump in ${timeDiffMinutes.toFixed(1)} minutes (index ${i - 1} → ${i})`,
      };
    }
  }

  return { detected: false, details: "No teleportation detected" };
}

/**
 * Detect unrealistic speed spikes in GPS log history.
 * Flags if any consecutive pair exceeds 150 km/h.
 *
 * @param {{ latitude: number, longitude: number, timestamp: string|Date }[]} gpsLogs
 * @returns {{ detected: boolean, maxSpeed: number, details: string }}
 */
export function detectSpeedSpike(gpsLogs) {
  if (gpsLogs.length < 2) {
    return { detected: false, maxSpeed: 0, details: "Insufficient GPS data" };
  }

  let maxSpeed = 0;

  for (let i = 1; i < gpsLogs.length; i++) {
    const speed = calculateSpeed(gpsLogs[i - 1], gpsLogs[i]);

    if (speed > maxSpeed) {
      maxSpeed = speed;
    }

    if (speed > GPS.MAX_SPEED_KMH) {
      return {
        detected: true,
        maxSpeed: speed,
        details: `Speed spike: ${speed.toFixed(1)} km/h between points ${i - 1} and ${i}`,
      };
    }
  }

  return {
    detected: false,
    maxSpeed,
    details: `Max speed: ${maxSpeed.toFixed(1)} km/h (within limits)`,
  };
}

/**
 * Validate that a user is within acceptable proximity of a POI.
 *
 * @param {number} userLat - User's latitude
 * @param {number} userLon - User's longitude
 * @param {number} poiLat  - POI's latitude
 * @param {number} poiLon  - POI's longitude
 * @returns {{ isValid: boolean, distanceMeters: number }}
 */
export function validateProximity(userLat, userLon, poiLat, poiLon) {
  const distanceMeters = calculateDistance(userLat, userLon, poiLat, poiLon);

  return {
    isValid: distanceMeters <= GPS.MAX_PROXIMITY_METERS,
    distanceMeters: Math.round(distanceMeters),
  };
}
