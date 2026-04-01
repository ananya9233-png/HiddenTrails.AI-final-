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
  // banasthali intentionally omitted — demo challenge skips GPS
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
      demoKnownImages,   // ← array of known building image URLs from frontend
    } = req.body;

    const DEMO_MODE = demoMode === true;
    console.log(
      "📸 VERIFY PHOTO HIT — Challenge:", challengeId,
      "| Gallery:", !!isGalleryUpload,
      "| Demo:", DEMO_MODE,
      "| Known images:", (demoKnownImages || []).length
    );

    if (!userImageBase64 || !referenceImageUrl) {
      return res.status(400).json({ error: "Both images are required" });
    }
    if (!challengeId) {
      return res.status(400).json({ error: "Challenge ID is required" });
    }

    const landmarkName =
      PHOTO_CHALLENGE.LANDMARK_NAMES[challengeId] ||
      challengeName ||
      "a famous landmark";

    // ── GPS Validation (skipped entirely for demo) ────────────────────────
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
            }
          }
        } catch (lookupErr) {
          console.warn("⚠️ Could not look up dynamic challenge coords:", lookupErr.message);
        }
      }

      if (poiCoords) {
        gpsValidation = await validateGPSForChallenge(
          {
            userId, poiId: challengeId, latitude, longitude,
            timestamp: timestamp || new Date().toISOString(),
            mockLocationFlag: mockLocationFlag || false,
          },
          poiCoords, db
        );
        await logGPSEntry(
          userId,
          { latitude, longitude, timestamp: timestamp || new Date().toISOString() },
          db
        );
        userWasNearLocation = gpsValidation.valid;
        if (!gpsValidation.valid) {
          console.log("⚠️ GPS failed (continuing to AI):", gpsValidation.errors);
        }
      } else {
        console.log(`ℹ️ No POI coords for '${challengeId}' — AI vision only`);
        await logGPSEntry(
          userId,
          { latitude, longitude, timestamp: timestamp || new Date().toISOString() },
          db
        );
      }
    }

    // ── AI Vision Verification ────────────────────────────────────────────
    // Pass demoMode + demoKnownImages into service so it can:
    //   • Use strict building-only prompt for demo live photos
    //   • Do fingerprint-based gallery check for demo gallery uploads
    const verificationResult = await verifyPhoto(
      userImageBase64,
      referenceImageUrl,
      landmarkName,
      !!isGalleryUpload,
      DEMO_MODE,
      demoKnownImages || []
    );

    // ── Points Calculation ────────────────────────────────────────────────
    const matchValid    = verificationResult.landmarkMatchScore >= PHOTO_CHALLENGE.MIN_LANDMARK_MATCH_SCORE;
    const livenessValid = verificationResult.livenessScore     >= PHOTO_CHALLENGE.MIN_LIVENESS_SCORE;

    let points  = 0;
    let message = "";

    if (DEMO_MODE) {
      // ── DEMO: gallery upload ──────────────────────────────────────────
      if (isGalleryUpload) {
        if (verificationResult.demoGalleryMatch) {
          // Known building photo from gallery → give demo points (no liveness bonus)
          points  = PHOTO_CHALLENGE.POINTS[challengeId] || 50;
          message = `🎓 Campus verified via gallery! Demo challenge complete. (Gallery photos earn points in demo mode.)`;
          console.log("✅ Demo gallery: known building matched → points:", points);
        } else {
          points  = 0;
          message = `🏛️ Wrong photo! Only your saved photos of the dept building are accepted in demo mode.`;
          console.log("🛡️ Demo gallery: unknown image → 0 pts");
        }

      // ── DEMO: live photo ──────────────────────────────────────────────
      } else {
        if (matchValid) {
          points  = PHOTO_CHALLENGE.POINTS[challengeId] || 50;
          message = `🎓 Building detected! Demo challenge complete. Welcome to Banasthali Vidyapeeth! ${verificationResult.reason || ""}`;
          console.log("✅ Demo live: building matched → points:", points);
        } else {
          points  = 0;
          message = verificationResult.reason
            ? `🚫 ${verificationResult.reason}`
            : `🚫 That doesn't look like the dept building. Point your camera at the building facade (not a person or room).`;
          console.log("🛡️ Demo live: no building detected → 0 pts. Reason:", verificationResult.reason);
        }
      }

    } else {
      // ── REGULAR challenge logic (unchanged) ──────────────────────────
      if (matchValid && livenessValid && !isGalleryUpload) {
        if (!userWasNearLocation && latitude && longitude) {
          points  = PHOTO_CHALLENGE.PARTIAL_MATCH_POINTS || 30;
          message = `📍 Photo verified but you're not at ${landmarkName}! Visit in person for full points.`;
          console.log("🛡️ Anti-exploit: GPS mismatch — partial points only");
        } else {
          points  = PHOTO_CHALLENGE.POINTS[challengeId] || 100;
          message = `🎉 Amazing! Your live photo of ${landmarkName} is verified! ${verificationResult.reason || ""}`;
        }
      } else if (isGalleryUpload && matchValid) {
        points  = 0;
        message = `📸 Nice try! We detected this is a gallery image of ${landmarkName}. Visit in person to earn points!`;
        console.log("🛡️ Anti-exploit: gallery upload — 0 pts, challenge incomplete");
      } else if (matchValid && !livenessValid) {
        points  = 0;
        message = `🖼️ This looks like a downloaded photo of ${landmarkName}. Take a live photo to earn points!`;
        console.log("🛡️ Anti-exploit: low liveness — 0 pts");
      } else {
        points  = 0;
        message = `😕 Your photo doesn't match ${landmarkName}. Try again from a better angle!`;
      }
    }

    // ── Award Points ──────────────────────────────────────────────────────
    let rewardResult = null;
    if (userId && points > 0 && !DEMO_MODE) {
      rewardResult = await awardPhotoPoints(userId, challengeId, points, verificationResult, db);
    }

    console.log(
      `✅ Result — Match: ${matchValid} (${verificationResult.landmarkMatchScore}),`,
      `Live: ${livenessValid} (${verificationResult.livenessScore}),`,
      `Points: ${points}, Demo: ${DEMO_MODE}`
    );

    res.json({
      match: matchValid,
      liveness: livenessValid,
      landmarkMatchScore: verificationResult.landmarkMatchScore,
      livenessScore: verificationResult.livenessScore,
      confidence: verificationResult.confidence,
      reason: verificationResult.reason,
      points,
      message,
      challengeId,
      totalPoints: rewardResult?.totalPoints || null,
      level: rewardResult?.level || null,
      demo: DEMO_MODE,
    });

  } catch (error) {
    console.error("❌ Photo verification error:", error);
    res.status(500).json({ error: "Photo verification failed", details: error.message });
  }
}