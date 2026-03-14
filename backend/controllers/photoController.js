/**
 * Photo Challenge Controller
 * ----------------------------
 * Handles the full photo verification pipeline:
 * 1. GPS validation (proximity, mock location, teleport, speed)
 * 2. AI vision verification (landmark match + liveness)
 * 3. Reward awarding on success
 */

import { verifyPhoto } from "../services/photoVerificationService.js";
import { validateGPSForChallenge, logGPSEntry } from "../services/gpsService.js";
import { awardPhotoPoints } from "../services/rewardService.js";
import { db } from "../config/firebase.js";
import { PHOTO_CHALLENGE } from "../config/constants.js";

// POI coordinates for GPS validation
const POI_COORDINATES = {
  tajmahal: { latitude: 27.1751, longitude: 78.0421 },
  indiagate: { latitude: 28.6129, longitude: 77.2295 },
  gateway: { latitude: 18.9220, longitude: 72.8347 },
  hawamahal: { latitude: 26.9239, longitude: 75.8267 },
  mysorepalace: { latitude: 12.3052, longitude: 76.6552 },
  goldentemple: { latitude: 31.6200, longitude: 74.8765 },
};

/**
 * POST /verify-photo or POST /photo/verify
 *
 * Full pipeline: GPS → Vision → Reward
 */
export async function handleVerifyPhoto(req, res) {
  try {
    const {
      userImageBase64,
      referenceImageUrl,
      challengeId,
      userId,
      latitude,
      longitude,
      timestamp,
      mockLocationFlag,
    } = req.body;

    console.log("📸 VERIFY PHOTO HIT — Challenge:", challengeId);

    // ---- Input validation ----
    if (!userImageBase64 || !referenceImageUrl) {
      return res.status(400).json({ error: "Both images are required" });
    }

    if (!challengeId) {
      return res.status(400).json({ error: "Challenge ID is required" });
    }

    const landmarkName =
      PHOTO_CHALLENGE.LANDMARK_NAMES[challengeId] || "a famous landmark";

    // ---- Step 1: GPS Validation (if coordinates provided) ----
    let gpsValidation = { valid: true, errors: [] };

    if (latitude && longitude && userId) {
      const poiCoords = POI_COORDINATES[challengeId];

      if (poiCoords) {
        gpsValidation = await validateGPSForChallenge(
          {
            userId,
            poiId: challengeId,
            latitude,
            longitude,
            timestamp: timestamp || new Date().toISOString(),
            mockLocationFlag: mockLocationFlag || false,
          },
          poiCoords,
          db
        );

        // Log the GPS entry regardless of validation result
        await logGPSEntry(
          userId,
          { latitude, longitude, timestamp: timestamp || new Date().toISOString() },
          db
        );
      }

      // If GPS validation fails, return early with errors
      if (!gpsValidation.valid) {
        console.log("❌ GPS validation failed:", gpsValidation.errors);
        return res.json({
          match: false,
          liveness: false,
          confidence: 0,
          points: 0,
          message: `📍 GPS validation failed: ${gpsValidation.errors.join(", ")}`,
          gpsErrors: gpsValidation.errors,
          challengeId,
        });
      }
    }

    // ---- Step 2: AI Vision Verification ----
    const verificationResult = await verifyPhoto(
      userImageBase64,
      referenceImageUrl,
      landmarkName
    );

    // ---- Step 3: Determine outcome and calculate points ----
    const matchValid =
      verificationResult.landmarkMatchScore >= PHOTO_CHALLENGE.MIN_LANDMARK_MATCH_SCORE;
    const livenessValid =
      verificationResult.livenessScore >= PHOTO_CHALLENGE.MIN_LIVENESS_SCORE;

    let points = 0;
    let message = "";

    if (matchValid && livenessValid) {
      // Full success — award full points
      points =
        PHOTO_CHALLENGE.POINTS[challengeId] || 100;
      message = `🎉 Amazing! Your live photo of ${landmarkName} is verified! ${verificationResult.reason || ""}`;
    } else if (matchValid && !livenessValid) {
      // Partial match — photo matches but not live
      points = PHOTO_CHALLENGE.PARTIAL_MATCH_POINTS;
      message = `📸 Photo matches ${landmarkName} but doesn't appear to be taken live. Visit the location for full points! ${verificationResult.reason || ""}`;
    } else {
      // No match
      points = 0;
      message = `😕 Your photo doesn't match ${landmarkName}. Try again from a better angle! ${verificationResult.reason || ""}`;
    }

    // ---- Step 4: Award points (if userId provided and points > 0) ----
    let rewardResult = null;
    if (userId && points > 0) {
      rewardResult = await awardPhotoPoints(
        userId,
        challengeId,
        points,
        verificationResult,
        db
      );
    }

    console.log(
      `✅ Result — Match: ${matchValid} (${verificationResult.landmarkMatchScore}), Live: ${livenessValid} (${verificationResult.livenessScore}), Points: ${points}`
    );

    res.json({
      match: matchValid,
      liveness: livenessValid,
      landmarkMatchScore: verificationResult.landmarkMatchScore,
      livenessScore: verificationResult.livenessScore,
      confidence: verificationResult.confidence,
      points,
      message,
      challengeId,
      totalPoints: rewardResult?.totalPoints || null,
      level: rewardResult?.level || null,
    });
  } catch (error) {
    console.error("❌ Photo verification error:", error);
    res
      .status(500)
      .json({ error: "Photo verification failed", details: error.message });
  }
}