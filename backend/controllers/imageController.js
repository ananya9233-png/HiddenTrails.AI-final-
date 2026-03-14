/**
 * Image Controller
 * ------------------
 * Handles HTTP request/response for destination image retrieval.
 */

import { getDestinationImage } from "../services/imageService.js";

/**
 * GET /get-destination-image?query=...
 *
 * Returns a relevant image URL for the given destination query.
 */
export async function handleGetImage(req, res) {
  try {
    const query = req.query.query || "travel India";

    console.log("🖼️ IMAGE HIT:", query);

    const image = await getDestinationImage(query);

    res.json({ image });
  } catch (error) {
    console.error("❌ Image error:", error);
    res.json({
      image:
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=400&fit=crop",
    });
  }
}