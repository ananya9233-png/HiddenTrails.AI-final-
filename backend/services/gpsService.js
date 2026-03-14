/**
 * GPS Service
 * -------------
 * Orchestrates GPS-related operations:
 * - Full GPS validation for photo challenges (proximity, mock detection, teleport, speed)
 * - GPS log persistence to Firestore
 * - Trip distance/duration validation
 */

import {
  calculateSpeed,
  detectTeleport,
  detectSpeedSpike,
  validateProximity,
} from "../utils/gpsValidator.js";
import { calculateDistanceKm } from "../utils/haversine.js";
import { TRIP } from "../config/constants.js";

/**
 * Run all GPS validation checks for a photo challenge submission.
 * This is the main orchestration function called by the photo controller.
 *
 * @param {{
 *   userId: string,
 *   poiId: string,
 *   latitude: number,
 *   longitude: number,
 *   timestamp: string|Date,
 *   mockLocationFlag: boolean
 * }} params
 * @param {{ latitude: number, longitude: number }} poiCoords - POI's actual coordinates
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
export async function validateGPSForChallenge(params, poiCoords, db) {
  const errors = [];

  // ---- Check 1: Mock location flag ----
  if (params.mockLocationFlag === true) {
    errors.push("Mock location detected — GPS spoofing is not allowed");
  }

  // ---- Check 2: Proximity to POI ----
  const proximity = validateProximity(
    params.latitude,
    params.longitude,
    poiCoords.latitude,
    poiCoords.longitude
  );

  if (!proximity.isValid) {
    errors.push(
      `Too far from POI: ${proximity.distanceMeters}m (max 150m allowed)`
    );
  }

  // ---- Check 3: Historical GPS analysis (teleport + speed) ----
  // Fetch recent GPS logs for this user (last 30 minutes)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const logsSnapshot = await db
    .collection("gpsLogs")
    .where("userId", "==", params.userId)
    .where("timestamp", ">=", thirtyMinAgo)
    .orderBy("timestamp", "asc")
    .limit(50)
    .get();

  const recentLogs = [];
  logsSnapshot.forEach((doc) => recentLogs.push(doc.data()));

  // Add the current point to the log for analysis
  recentLogs.push({
    latitude: params.latitude,
    longitude: params.longitude,
    timestamp: new Date(params.timestamp),
  });

  // Check for teleportation (>20km in 5 minutes)
  if (recentLogs.length >= 2) {
    const teleportResult = detectTeleport(recentLogs);
    if (teleportResult.detected) {
      errors.push(`GPS teleport: ${teleportResult.details}`);
    }

    // Check for speed spikes (>150 km/h)
    const speedResult = detectSpeedSpike(recentLogs);
    if (speedResult.detected) {
      errors.push(`Speed spike: ${speedResult.details}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log a GPS entry to Firestore for historical analysis.
 *
 * @param {string} userId
 * @param {{ latitude: number, longitude: number, timestamp: string|Date }} gpsData
 * @param {admin.firestore.Firestore} db
 */
export async function logGPSEntry(userId, gpsData, db) {
  await db.collection("gpsLogs").add({
    userId,
    latitude: gpsData.latitude,
    longitude: gpsData.longitude,
    timestamp: new Date(gpsData.timestamp),
    loggedAt: new Date(),
  });
}

/**
 * Validate a completed trip against minimum criteria.
 * A trip is valid only if it meets distance, duration, and POI requirements.
 *
 * @param {{
 *   gpsPoints: { latitude: number, longitude: number, timestamp: string|Date }[],
 *   visitedPOIs: { poiId: string, arrivalTime: Date, departureTime: Date }[]
 * }} tripData
 * @returns {{ valid: boolean, errors: string[], stats: { totalDistanceKm: number, durationHours: number, uniquePOIs: number } }}
 */
export function validateTrip(tripData) {
  const errors = [];
  const { gpsPoints, visitedPOIs } = tripData;

  // ---- Calculate total distance ----
  let totalDistanceKm = 0;
  for (let i = 1; i < gpsPoints.length; i++) {
    totalDistanceKm += calculateDistanceKm(
      gpsPoints[i - 1].latitude,
      gpsPoints[i - 1].longitude,
      gpsPoints[i].latitude,
      gpsPoints[i].longitude
    );
  }

  if (totalDistanceKm < TRIP.MIN_DISTANCE_KM) {
    errors.push(
      `Insufficient distance: ${totalDistanceKm.toFixed(1)}km (minimum ${TRIP.MIN_DISTANCE_KM}km)`
    );
  }

  // ---- Calculate trip duration ----
  if (gpsPoints.length >= 2) {
    const startTime = new Date(gpsPoints[0].timestamp);
    const endTime = new Date(gpsPoints[gpsPoints.length - 1].timestamp);
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);

    if (durationHours < TRIP.MIN_DURATION_HOURS) {
      errors.push(
        `Trip too short: ${durationHours.toFixed(1)} hours (minimum ${TRIP.MIN_DURATION_HOURS} hours)`
      );
    }
  } else {
    errors.push("Insufficient GPS data to calculate duration");
  }

  // ---- Validate unique POIs ----
  const uniquePOIIds = new Set(visitedPOIs.map((p) => p.poiId));
  if (uniquePOIIds.size < TRIP.MIN_UNIQUE_POIS) {
    errors.push(
      `Too few POIs visited: ${uniquePOIIds.size} (minimum ${TRIP.MIN_UNIQUE_POIS})`
    );
  }

  // ---- Validate stay duration at each POI ----
  for (const poi of visitedPOIs) {
    const stayMinutes =
      (new Date(poi.departureTime) - new Date(poi.arrivalTime)) / (1000 * 60);

    if (stayMinutes < TRIP.MIN_POI_STAY_MINUTES) {
      errors.push(
        `POI ${poi.poiId}: stayed only ${stayMinutes.toFixed(0)} min (minimum ${TRIP.MIN_POI_STAY_MINUTES} min)`
      );
    }
  }

  // ---- Check for suspicious GPS activity ----
  const teleportCheck = detectTeleport(gpsPoints);
  if (teleportCheck.detected) {
    errors.push(`Suspicious GPS: ${teleportCheck.details}`);
  }

  const speedCheck = detectSpeedSpike(gpsPoints);
  if (speedCheck.detected) {
    errors.push(`Suspicious GPS: ${speedCheck.details}`);
  }

  const durationHours =
    gpsPoints.length >= 2
      ? (new Date(gpsPoints[gpsPoints.length - 1].timestamp) -
          new Date(gpsPoints[0].timestamp)) /
        (1000 * 60 * 60)
      : 0;

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
      durationHours: parseFloat(durationHours.toFixed(2)),
      uniquePOIs: uniquePOIIds.size,
    },
  };
}
