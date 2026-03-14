/**
 * Itinerary Routes
 * ------------------
 * POST /generate-itinerary  — Generate a new AI itinerary
 * POST /regenerate-itinerary — Regenerate an existing trip's itinerary
 */

import { Router } from "express";
import {
  handleGenerateItinerary,
  handleRegenerateItinerary,
} from "../controllers/itineraryController.js";

const router = Router();

router.post("/generate-itinerary", handleGenerateItinerary);
router.post("/regenerate-itinerary", handleRegenerateItinerary);

export default router;
