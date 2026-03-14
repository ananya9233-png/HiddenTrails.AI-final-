/**
 * Challenge Generation Service
 * ---------------------------------
 * Auto-generates photo challenges based on itinerary destinations.
 * Uses the Groq AI to extract landmark names from the itinerary,
 * then creates challenges in the Firestore "photoChallenges" collection.
 */

import fetch from "node-fetch";
import {
  GROQ_BASE_URL,
  getGroqHeaders,
  LLAMA_TEXT_MODEL,
} from "../config/groq.js";

/**
 * Generate photo challenges for a destination's landmarks.
 * Calls AI to extract key landmarks from destination, then saves as challenges.
 *
 * @param {string} userId - Firebase user ID
 * @param {string} destination - Trip destination (e.g. "Goa")
 * @param {Array} itineraryDays - Array of itinerary day objects
 * @param {admin.firestore.Firestore} db - Firestore instance
 */
export async function generatePhotoChallenges(userId, destination, itineraryDays, db) {
  try {
    // Extract place names from the itinerary text
    const itineraryText = itineraryDays.map(d =>
      `Day ${d.day}: ${d.title}. ${d.morning} ${d.afternoon} ${d.evening || ''}`
    ).join('\n');

    const prompt = `From this travel itinerary for ${destination}, extract the top 4-6 famous landmarks or tourist spots that a traveler could photograph.

Itinerary:
${itineraryText}

You MUST respond ONLY in this exact JSON format with no extra text:
{
  "challenges": [
    {
      "name": "Landmark Name",
      "description": "Take a photo of this iconic spot",
      "difficulty": "Easy",
      "points": 100
    }
  ]
}

Rules:
- Extract REAL landmark/attraction names mentioned in the itinerary
- Each challenge should be a photographable landmark or spot
- Points: Easy=100, Medium=130, Hard=150
- difficulty can be Easy, Medium, or Hard based on how iconic/accessible the spot is
- description should be a short challenge instruction (e.g. "Capture the sunset at Baga Beach")
- Return ONLY valid JSON, max 6 challenges`;

    const response = await fetch(GROQ_BASE_URL, {
      method: "POST",
      headers: getGroqHeaders(),
      body: JSON.stringify({
        model: LLAMA_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a JSON API for extracting travel landmarks. Output ONLY valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;

    if (!rawText) {
      console.warn("⚠️ No challenge data from AI");
      return;
    }

    // Parse AI response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("⚠️ Failed to parse challenge JSON");
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.challenges || !Array.isArray(parsed.challenges)) {
      console.warn("⚠️ Invalid challenge format");
      return;
    }

    // ======= AUTO-EXPIRE OLD CHALLENGES =======
    // 1. Delete old challenges for the SAME destination (replace with fresh ones)
    const existingSameDest = await db.collection("photoChallenges")
      .where("userId", "==", userId)
      .where("destination", "==", destination)
      .get();

    if (!existingSameDest.empty) {
      const deleteBatch = db.batch();
      existingSameDest.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      console.log(`🗑️ Deleted ${existingSameDest.size} old challenges for ${destination}`);
    }

    // 2. Cleanup: delete completed challenges older than 7 days from ANY destination
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const oldCompleted = await db.collection("photoChallenges")
        .where("userId", "==", userId)
        .where("completed", "==", true)
        .get();

      if (!oldCompleted.empty) {
        const cleanupBatch = db.batch();
        let cleanupCount = 0;
        oldCompleted.forEach(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          if (createdAt < sevenDaysAgo) {
            cleanupBatch.delete(doc.ref);
            cleanupCount++;
          }
        });
        if (cleanupCount > 0) {
          await cleanupBatch.commit();
          console.log(`🧹 Cleaned up ${cleanupCount} old completed challenges`);
        }
      }
    } catch (cleanupErr) {
      console.warn("⚠️ Challenge cleanup error (non-fatal):", cleanupErr.message);
    }

    // 3. Also cleanup uncompleted challenges older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
      const allUserChallenges = await db.collection("photoChallenges")
        .where("userId", "==", userId)
        .get();

      if (!allUserChallenges.empty) {
        const expireBatch = db.batch();
        let expireCount = 0;
        allUserChallenges.forEach(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          if (createdAt < thirtyDaysAgo && data.destination !== destination) {
            expireBatch.delete(doc.ref);
            expireCount++;
          }
        });
        if (expireCount > 0) {
          await expireBatch.commit();
          console.log(`🧹 Expired ${expireCount} challenges older than 30 days`);
        }
      }
    } catch (expireErr) {
      console.warn("⚠️ Challenge expiry error (non-fatal):", expireErr.message);
    }

    // ======= SAVE NEW CHALLENGES =======
    const batch = db.batch();
    for (const challenge of parsed.challenges) {
      const docRef = db.collection("photoChallenges").doc();
      batch.set(docRef, {
        userId,
        destination,
        name: challenge.name,
        description: challenge.description || `Photograph ${challenge.name}`,
        difficulty: challenge.difficulty || "Medium",
        points: challenge.points || 100,
        completed: false,
        image: null, // Will be fetched from Wikipedia API on frontend
        createdAt: new Date(),
      });
    }

    await batch.commit();
    console.log(`📸 Generated ${parsed.challenges.length} photo challenges for ${destination}`);

  } catch (err) {
    // Don't crash itinerary generation if challenges fail
    console.error("⚠️ Challenge generation error (non-fatal):", err.message);
  }
}
