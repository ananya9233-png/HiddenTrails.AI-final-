/**
 * Reward Routes
 * ---------------
 * GET  /rewards/:userId     — Get user's rewards, level, and progress
 * POST /rewards/claim-trip  — Claim reward for a validated trip
 */

import { Router } from "express";
import {
  handleGetRewards,
  handleClaimTripReward,
} from "../controllers/rewardController.js";

const router = Router();

// POST route must be registered BEFORE the parameterized GET route
// to avoid Express matching "claim-trip" as a :userId parameter
router.post("/rewards/claim-trip", handleClaimTripReward);
router.get("/rewards/:userId", handleGetRewards);

export default router;
