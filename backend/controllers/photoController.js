/**
 * Photo Challenge Controller
 */

import { verifyPhoto } from "../services/photoVerificationService.js";
import { validateGPSForChallenge, logGPSEntry } from "../services/gpsService.js";
import { awardPhotoPoints } from "../services/rewardService.js";
import { db } from "../config/firebase.js";
import { PHOTO_CHALLENGE } from "../config/constants.js";

const POI_COORDINATES = {
  tajmahal:     { latitude: 27.1751, longitude: 78.0421 },
  indiagate:    { latitude: 28.6129, longitude: 77.2295 },
  gateway:      { latitude: 18.9220, longitude: 72.8347 },
  hawamahal:    { latitude: 26.9239, longitude: 75.8267 },
  mysorepalace: { latitude: 12.3052, longitude: 76.6552 },
  goldentemple: { latitude: 31.6200, longitude: 74.8765 },
};

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
      isGalleryUpload,
      challengeName,
      demoMode,
    } = req.body;

    const DEMO_MODE = demoMode === true;
    console.log("📸 VERIFY PHOTO HIT — Challenge:", challengeId, "| Gallery:", !!isGalleryUpload, "| Demo:", DEMO_MODE);

    if (!userImageBase64 || !referenceImageUrl) {
      return res.status(400).json({ error: "Both images are required" });
    }
    if (!challengeId) {
      return res.status(400).json({ error: "Challenge ID is required" });
    }

    // FIX 1: Use hardcoded name, then frontend-sent name, then fallback
    const landmarkName =
      PHOTO_CHALLENGE.LANDMARK_NAMES[challengeId] ||
      challengeName ||
      "a famous landmark";

    // ---- GPS Validation ----
    let gpsValidation = { valid: true, errors: [] };
    let userWasNearLocation = true;

    if (!DEMO_MODE && latitude && longitude && userId) {
      let poiCoords = POI_COORDINATES[challengeId] || null;

      if (!poiCoords) {
        try {
          const challengeDoc = await db.collection("photoChallenges").doc(challengeId).get();
          if (challengeDoc.exists) {
            const cData = challengeDoc.data();
            if (cData.latitude && cData.longitude) {
              poiCoords = { latitude: cData.latitude, longitude: cData.longitude };
              console.log(`📍 Using Firestore coords for: ${challengeId}`);
            }
          }
        } catch (lookupErr) {
          console.warn("⚠️ Could not look up dynamic challenge coords:", lookupErr.message);
        }
      }

      if (poiCoords) {
        gpsValidation = await validateGPSForChallenge(
          { userId, poiId: challengeId, latitude, longitude,
            timestamp: timestamp || new Date().toISOString(),
            mockLocationFlag: mockLocationFlag || false },
          poiCoords,
          db
        );
        await logGPSEntry(userId, { latitude, longitude, timestamp: timestamp || new Date().toISOString() }, db);
        userWasNearLocation = gpsValidation.valid;
        if (!gpsValidation.valid) {
          console.log("⚠️ GPS failed (continuing to AI):", gpsValidation.errors);
        }
      } else {
        console.log(`ℹ️ No POI coords for '${challengeId}' — AI vision only`);
        await logGPSEntry(userId, { latitude, longitude, timestamp: timestamp || new Date().toISOString() }, db);
      }
    }

    // ---- AI Vision Verification ----
    const verificationResult = await verifyPhoto(
      userImageBase64,
      referenceImageUrl,
      landmarkName,
      !!isGalleryUpload
    );

    // ---- Points Calculation ----
    const matchValid   = verificationResult.landmarkMatchScore >= PHOTO_CHALLENGE.MIN_LANDMARK_MATCH_SCORE;
    const livenessValid = verificationResult.livenessScore >= PHOTO_CHALLENGE.MIN_LIVENESS_SCORE;

    let points = 0;
    let message = "";

    if (matchValid && livenessValid && !isGalleryUpload) {
  // ✅ ONLY case that gives full points — live photo, real liveness
  if (!userWasNearLocation && latitude && longitude) {
    // Live photo but wrong GPS location — partial
    points = PHOTO_CHALLENGE.PARTIAL_MATCH_POINTS || 30;
    message = `📍 Photo verified but you're not at ${landmarkName}! Visit in person for full points.`;
    console.log("🛡️ Anti-exploit: GPS mismatch — partial points only");
  } else {
    points = PHOTO_CHALLENGE.POINTS[challengeId] || 100;
    message = `🎉 Amazing! Your live photo of ${landmarkName} is verified! ${verificationResult.reason || ""}`;
  }

} else if (isGalleryUpload && matchValid) {
  // ❌ Gallery upload — landmark recognized but 0 points, challenge stays incomplete
  points = 0;
  message = `📸 Nice try! We detected this is a gallery image of ${landmarkName}. Visit in person to earn points!`;
  console.log("🛡️ Anti-exploit: gallery upload — 0 points, challenge incomplete");

} else if (matchValid && !livenessValid) {
  // ❌ Looks like screenshot/downloaded image — 0 points
  points = 0;
  message = `🖼️ This looks like a downloaded photo of ${landmarkName}. Take a live photo to earn points!`;
  console.log("🛡️ Anti-exploit: low liveness — 0 points");

} else {
  // ❌ Doesn't match landmark at all
  points = 0;
  message = `😕 Your photo doesn't match ${landmarkName}. Try again from a better angle!`;
}

    
    // ---- Award Points ----
    let rewardResult = null;
    if (userId && points > 0 && !DEMO_MODE) {
      rewardResult = await awardPhotoPoints(userId, challengeId, points, verificationResult, db);
    }

    console.log(`✅ Result — Match: ${matchValid} (${verificationResult.landmarkMatchScore}), Live: ${livenessValid} (${verificationResult.livenessScore}), Points: ${points}`);

    res.json({
      match: matchValid,
      liveness: livenessValid,
      landmarkMatchScore: verificationResult.landmarkMatchScore,
      livenessScore: verificationResult.livenessScore,
      confidence: verificationResult.confidence,
      reason: verificationResult.reason,   // FIX 4: always included
      points,
      message,
      challengeId,
      totalPoints: rewardResult?.totalPoints || null,
      level: rewardResult?.level || null,
      demo: DEMO_MODE,                     // FIX 5: passed back to frontend
    });

  } catch (error) {
    console.error("❌ Photo verification error:", error);
    res.status(500).json({ error: "Photo verification failed", details: error.message });
  }
}