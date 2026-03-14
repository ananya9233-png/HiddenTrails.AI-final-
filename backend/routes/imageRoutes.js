/**
 * Image Routes
 * ---------------
 * GET /get-destination-image?query=... — Fetch a destination image
 */

import { Router } from "express";
import { handleGetImage } from "../controllers/imageController.js";

const router = Router();

router.get("/get-destination-image", handleGetImage);

export default router;
