/**
 * Photo Challenge Routes
 * ------------------------
 * POST /verify-photo           — Verify a photo (backwards compatible)
 * POST /photo/verify           — Verify a photo (new RESTful path)
 * GET  /photo-challenges/:userId — Get user's photo challenges
 */

import { Router } from "express";
import { handleVerifyPhoto } from "../controllers/photoController.js";
import { db } from "../config/firebase.js";

const router = Router();

// Both paths point to the same handler for compatibility
router.post("/verify-photo", handleVerifyPhoto);
router.post("/photo/verify", handleVerifyPhoto);

// GET /photo-challenges/:userId — fetch user's dynamic challenges from Firestore
router.get("/photo-challenges/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const snapshot = await db.collection("photoChallenges")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const challenges = [];
    snapshot.forEach(doc => {
      challenges.push({ id: doc.id, ...doc.data() });
    });

    res.json({ challenges });
  } catch (err) {
    console.error("❌ Fetch challenges error:", err);
    // Fallback: try without ordering if index missing
    try {
      const snapshot = await db.collection("photoChallenges")
        .where("userId", "==", req.params.userId)
        .get();
      const challenges = [];
      snapshot.forEach(doc => {
        challenges.push({ id: doc.id, ...doc.data() });
      });
      res.json({ challenges });
    } catch (err2) {
      res.status(500).json({ error: "Failed to fetch challenges", challenges: [] });
    }
  }
});

export default router;
