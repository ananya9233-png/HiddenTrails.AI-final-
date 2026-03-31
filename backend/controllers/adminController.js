/**
 * Admin Controller
 * ------------------
 * CRUD handlers for the touristPlaces Firestore collection.
 * Allows admin/developer to manage curated tourist place data
 * (images, descriptions, GPS coords) that takes priority over
 * API-fetched data in itineraries and photo challenges.
 */

import { db } from "../config/firebase.js";
import { clearImageCache } from "../services/imageService.js";

const COLLECTION = "touristPlaces";

/**
 * GET /admin/places
 * List all tourist places from Firestore
 */
export async function listPlaces(req, res) {
  try {
    const snapshot = await db.collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    const places = [];
    snapshot.forEach(doc => {
      places.push({ id: doc.id, ...doc.data() });
    });

    res.json({ places, total: places.length });
  } catch (error) {
    console.error("❌ Admin listPlaces error:", error);
    res.status(500).json({ error: "Failed to fetch places" });
  }
}

/**
 * POST /admin/places
 * Add a new tourist place
 */
export async function addPlace(req, res) {
  try {
    const { name, location, latitude, longitude, imageUrl, description, difficulty, points, tags } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Place name is required" });
    }
    if (!imageUrl || !imageUrl.trim()) {
      return res.status(400).json({ error: "Image URL is required" });
    }

    const placeData = {
      name: name.trim(),
      location: (location || "").trim(),
      latitude: parseFloat(latitude) || null,
      longitude: parseFloat(longitude) || null,
      imageUrl: imageUrl.trim(),
      description: (description || "").trim(),
      difficulty: difficulty || "Medium",
      points: parseInt(points) || 100,
      tags: Array.isArray(tags) ? tags : (tags || "").split(",").map(t => t.trim()).filter(Boolean),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection(COLLECTION).add(placeData);
    console.log(`✅ Admin added place: ${placeData.name} (${docRef.id})`);

    // Clear image cache so new place is used immediately
    clearImageCache();

    res.status(201).json({ id: docRef.id, ...placeData });
  } catch (error) {
    console.error("❌ Admin addPlace error:", error);
    res.status(500).json({ error: "Failed to add place" });
  }
}

/**
 * PUT /admin/places/:id
 * Update an existing tourist place
 */
export async function updatePlace(req, res) {
  try {
    const { id } = req.params;
    const { name, location, latitude, longitude, imageUrl, description, difficulty, points, tags } = req.body;

    // Check if exists
    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Place not found" });
    }

    const updateData = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude) || null;
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude) || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (points !== undefined) updateData.points = parseInt(points) || 100;
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim()).filter(Boolean);
    }

    await docRef.update(updateData);
    console.log(`✅ Admin updated place: ${id}`);

    // Clear image cache so updated place is used immediately
    clearImageCache();

    const updated = await docRef.get();
    res.json({ id, ...updated.data() });
  } catch (error) {
    console.error("❌ Admin updatePlace error:", error);
    res.status(500).json({ error: "Failed to update place" });
  }
}

/**
 * DELETE /admin/places/:id
 * Delete a tourist place
 */
export async function deletePlace(req, res) {
  try {
    const { id } = req.params;

    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Place not found" });
    }

    const placeName = doc.data().name;
    await docRef.delete();
    console.log(`🗑️ Admin deleted place: ${placeName} (${id})`);

    // Clear image cache so deleted place stops being returned
    clearImageCache();

    res.json({ message: `Deleted "${placeName}" successfully` });
  } catch (error) {
    console.error("❌ Admin deletePlace error:", error);
    res.status(500).json({ error: "Failed to delete place" });
  }
}

/**
 * GET /admin/places/search?q=...
 * Search places by name (case-insensitive partial match)
 */
export async function searchPlaces(req, res) {
  try {
    const query = (req.query.q || "").trim().toLowerCase();
    if (!query) {
      return res.json({ places: [], total: 0 });
    }

    // Firestore doesn't support case-insensitive search natively,
    // so we fetch all and filter in-memory (fine for <1000 places)
    const snapshot = await db.collection(COLLECTION).get();
    const places = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const nameMatch = (data.name || "").toLowerCase().includes(query);
      const locationMatch = (data.location || "").toLowerCase().includes(query);
      const tagMatch = (data.tags || []).some(t => t.toLowerCase().includes(query));

      if (nameMatch || locationMatch || tagMatch) {
        places.push({ id: doc.id, ...data });
      }
    });

    res.json({ places, total: places.length });
  } catch (error) {
    console.error("❌ Admin searchPlaces error:", error);
    res.status(500).json({ error: "Failed to search places" });
  }
}

/**
 * Lookup a place by name from the touristPlaces collection.
 * Used internally by imageService for database-first lookups.
 * 
 * IMPORTANT: Only matches when the query actually contains words
 * from the PLACE NAME — location-only matches are rejected.
 * e.g. "India Gate Delhi" must NOT match "Red Fort" just because of "Delhi".
 * 
 * @param {string} query - Search query (e.g., "Red Fort Delhi")
 * @returns {Promise<{imageUrl: string, description: string, name: string, latitude: number, longitude: number} | null>}
 */
export async function findPlaceByQuery(query) {
  try {
    if (!query || query.length < 2) return null;

    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

    // Common filler words to ignore
    const stopWords = new Set([
      'the', 'of', 'in', 'at', 'to', 'for', 'and', 'or', 'is', 'on', 'by',
      'with', 'from', 'tourist', 'landmark', 'spot', 'place', 'india', 'visit',
      'explore', 'near', 'famous', 'iconic', 'historic', 'beautiful',
    ]);

    const meaningfulQueryWords = queryWords.filter(w => !stopWords.has(w));

    const snapshot = await db.collection(COLLECTION).get();
    
    if (snapshot.empty) return null;

    let bestMatch = null;
    let bestNameScore = 0;  // Track name-specific score separately

    snapshot.forEach(doc => {
      const data = doc.data();
      const nameLower = (data.name || "").toLowerCase();
      const locationLower = (data.location || "").toLowerCase();
      const nameWords = nameLower.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));

      let nameScore = 0;   // Score from name matches ONLY
      let bonusScore = 0;  // Extra score from location/tags (only matters if name matched)

      // CHECK 1: Full name containment — strongest signal
      // "red fort delhi" contains "red fort" → definite match
      if (queryLower.includes(nameLower)) {
        nameScore += 20;
      }
      // "red fort" contains "red fort complex" → also strong  
      else if (nameLower.includes(queryLower)) {
        nameScore += 15;
      }

      // CHECK 2: ALL words of the place name appear in query
      // "Red Fort" → ["red", "fort"] — both must be in query
      if (nameWords.length > 0 && nameScore === 0) {
        const allNameWordsInQuery = nameWords.every(nw => queryLower.includes(nw));
        if (allNameWordsInQuery) {
          nameScore += 10;
        }
      }

      // CHECK 3: At least one significant name word in query
      if (nameScore === 0) {
        for (const nw of nameWords) {
          if (meaningfulQueryWords.includes(nw)) {
            nameScore += 3;
          }
        }
      }

      // BONUS: Location match (only adds value if name already matched)
      if (nameScore > 0) {
        for (const word of meaningfulQueryWords) {
          if (locationLower.includes(word)) bonusScore += 1;
        }
      }

      const totalScore = nameScore + bonusScore;

      if (totalScore > bestNameScore) {
        bestNameScore = totalScore;
        bestMatch = { id: doc.id, ...data };
      }
    });

    // REQUIRE name-level match (nameScore must be > 0, which means threshold >= 3)
    if (bestNameScore >= 3 && bestMatch) {
      console.log(`🗄️ Database match for "${query}" → "${bestMatch.name}" (score: ${bestNameScore})`);
      return bestMatch;
    }

    console.log(`🗄️ No database match for "${query}" (best score: ${bestNameScore})`);
    return null;
  } catch (error) {
    console.error("❌ findPlaceByQuery error:", error.message);
    return null;
  }
}


