/**
 * Admin Routes
 * ---------------
 * CRUD endpoints for managing tourist places in the database.
 * Protected by a simple admin key header (x-admin-key).
 *
 * GET    /admin/places          — List all places
 * GET    /admin/places/search   — Search by name/location
 * POST   /admin/places          — Add a new place
 * PUT    /admin/places/:id      — Update a place
 * DELETE /admin/places/:id      — Delete a place
 */

import { Router } from "express";
import {
  listPlaces,
  addPlace,
  updatePlace,
  deletePlace,
  searchPlaces,
} from "../controllers/adminController.js";

const router = Router();

/**
 * Admin auth middleware — checks x-admin-key header
 */
function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  const providedKey = req.headers["x-admin-key"];

  if (!adminKey) {
    console.error("❌ ADMIN_KEY not set in .env");
    return res.status(500).json({ error: "Admin key not configured on server" });
  }

  if (providedKey !== adminKey) {
    return res.status(401).json({ error: "Unauthorized — invalid admin key" });
  }

  next();
}

// Apply auth to all admin routes
router.use("/admin", adminAuth);

// Routes
router.get("/admin/places", listPlaces);
router.get("/admin/places/search", searchPlaces);
router.post("/admin/places", addPlace);
router.put("/admin/places/:id", updatePlace);
router.delete("/admin/places/:id", deletePlace);

export default router;
