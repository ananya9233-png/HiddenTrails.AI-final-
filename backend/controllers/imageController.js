/**
 * Image Controller
 * ------------------
 * Handles HTTP request/response for destination image retrieval.
 * Returns null if no relevant image is found (instead of a generic fallback).
 * Now also returns source info (database vs wikipedia) and description.
 */

import { getDestinationImage } from "../services/imageService.js";
import { findPlaceByQuery } from "./adminController.js";

/**
 * GET /get-destination-image?query=...
 *
 * Returns a relevant image URL for the given destination query.
 * Checks admin database first, then falls back to Wikipedia.
 * Returns { image, source, description } for richer frontend display.
 */
export async function handleGetImage(req, res) {
  try {
    const query = req.query.query || "";

    if (!query || query.length < 2) {
      return res.json({ image: null, source: null, description: null });
    }

    console.log("🖼️ IMAGE HIT:", query);

    // Check database first for description
    const dbPlace = await findPlaceByQuery(query);

    const image = await getDestinationImage(query);

    res.json({
      image: image || null,
      source: dbPlace ? "database" : (image ? "wikipedia" : null),
      description: dbPlace?.description || null,
      name: dbPlace?.name || null,
    });
  } catch (error) {
    console.error("❌ Image error:", error);
    res.json({ image: null, source: null, description: null });
  }
}