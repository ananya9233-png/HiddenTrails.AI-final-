/**
 * Itinerary Generation Service
 * ------------------------------
 * Handles AI-powered itinerary generation via Groq LLaMA 3.1.
 * Includes structured prompt engineering, JSON parsing with fallback,
 * and Firestore persistence for trip data.
 */

import fetch from "node-fetch";
import {
  GROQ_BASE_URL,
  getGroqHeaders,
  LLAMA_TEXT_MODEL,
} from "../config/groq.js";
import { ITINERARY } from "../config/constants.js";

/**
 * Generate a day-by-day travel itinerary using Groq LLaMA 3.1.
 *
 * @param {{ destination: string, days: number, preference: string, budget: number }} params
 * @returns {Promise<{ days: Array, total_estimated_cost: number }>}
 */
export async function generateItinerary({ destination, days, preference, budget }) {
  const numDays = parseInt(days) || 3;

  // Structured prompt with explicit JSON schema to ensure parseable output
  const prompt = `Create a ${numDays}-day travel itinerary for ${destination}. Budget: ₹${budget}. Trip vibe: ${preference}.

You MUST respond ONLY in this exact JSON format with no extra text:
{
  "days": [
    {
      "day": 1,
      "title": "Heritage & Cultural Exploration",
      "morning": "Start your day with breakfast at a local cafe, then visit [famous landmark in ${destination}]. Entry fee ₹200.",
      "afternoon": "Have lunch at [popular restaurant in ${destination}]. Then explore [real attraction in ${destination}] and enjoy the scenery.",
      "evening": "Enjoy the evening at [real spot in ${destination}], followed by dinner at [real restaurant]. Try the local cuisine.",
      "estimated_cost": 5000
    }
  ],
  "total_estimated_cost": 15000
}

Rules:
- CRITICAL: The "title" for each day MUST be specific to ${destination}. DO NOT use generic titles like "Beach Vibes" unless ${destination} actually has beaches. Use titles that reflect what ${destination} is known for (e.g. heritage, temples, forts, food, markets, nature, wildlife, etc.)
- Each "morning", "afternoon", "evening" must be a descriptive sentence (2-3 sentences with specific real place names in ${destination})
- "estimated_cost" is the total cost for that day in INR (number, not string)
- Include REAL place names, restaurants, and attractions that actually exist in ${destination}
- Include travel tips and eco-friendly suggestions where possible
- Return ONLY valid JSON, no extra text or markdown`;

const response = await fetch(GROQ_BASE_URL, {
  method: "POST",
  headers: getGroqHeaders(),
  body: JSON.stringify({
    model: LLAMA_TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a travel itinerary API. You ONLY output valid JSON. Never include markdown, explanations, or extra text. Only raw JSON.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: ITINERARY.MAX_TOKENS,
    temperature: ITINERARY.TEMPERATURE,
  }),
});

console.log("Groq HTTP status:", response.status);

const data = await response.json();
console.log("FULL GROQ RESPONSE:", JSON.stringify(data, null, 2));

const rawText =
  data?.choices?.[0]?.message?.content ||
  data?.choices?.[0]?.text ||
  null;
  console.log("📝 Raw itinerary text:", rawText?.substring(0, 300));

  if (!rawText) {
    throw new Error("No itinerary generated from AI model");
  }

  // Attempt to parse JSON from AI response
  return parseItineraryResponse(rawText, numDays, destination, budget);
}

/**
 * Parse the AI response text into a structured itinerary object.
 * Includes regex JSON extraction and a fallback generator for robustness.
 *
 * @param {string} rawText   - Raw text from AI model
 * @param {number} numDays   - Number of days requested
 * @param {string} destination - Trip destination
 * @param {number} budget    - Trip budget in INR
 * @returns {{ days: Array, total_estimated_cost: number }}
 */
function parseItineraryResponse(rawText, numDays, destination, budget) {
  try {
    // Extract JSON object from potentially messy AI output
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.days && Array.isArray(parsed.days)) {

  // Ensure estimated costs do not exceed budget
  const maxPerDay = Math.round(budget / numDays);

  parsed.days = parsed.days.map(day => ({
    ...day,
    estimated_cost: Math.min(day.estimated_cost || maxPerDay, maxPerDay)
  }));

  parsed.total_estimated_cost = parsed.days.reduce(
    (sum, d) => sum + (d.estimated_cost || 0),
    0
  );

  return parsed;
}
      
    }
    throw new Error("No valid JSON structure found in response");
  } catch (parseErr) {
    console.error("❌ Itinerary JSON parse error:", parseErr.message);

    // Fallback: generate a minimal but valid itinerary structure
    return {
      days: Array.from({ length: numDays }, (_, i) => ({
        day: i + 1,
        title: `Day ${i + 1} in ${destination}`,
        morning: `Start your morning exploring the local area of ${destination}. Visit nearby attractions and enjoy breakfast at a popular cafe.`,
        afternoon: `After lunch at a local restaurant, continue sightseeing around ${destination}. Explore markets and cultural spots.`,
        evening: `Wind down with dinner at a well-known restaurant in ${destination}. Enjoy the local nightlife or relax at your hotel.`,
        estimated_cost: Math.round(budget / numDays),
      })),
      total_estimated_cost: budget,
    };
  }
}

/**
 * Save a generated itinerary to Firestore under the "trips" collection.
 *
 * @param {string} userId        - Firebase Auth UID of the user
 * @param {{ destination: string, days: number, budget: number, preference: string, arrivalDate: string, returnDate: string }} tripMeta
 * @param {{ days: Array, total_estimated_cost: number }} itinerary
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<string>} The Firestore document ID of the saved trip
 */
export async function saveItineraryToFirestore(userId, tripMeta, itinerary, db) {
  const docRef = await db.collection("trips").add({
    userId,
    destination: tripMeta.destination,
    daysCount: tripMeta.days,
    budget: tripMeta.budget,
    preference: tripMeta.preference,
    arrivalDate: tripMeta.arrivalDate || null,
    returnDate: tripMeta.returnDate || null,
    total_estimated_cost: itinerary.total_estimated_cost,
    days: itinerary.days,
    createdAt: new Date(),
  });

  console.log(`✅ Trip saved to Firestore: ${docRef.id}`);
  return docRef.id;
}

/**
 * Regenerate the itinerary for an existing trip.
 * Fetches the trip from Firestore, regenerates via AI, and updates the document.
 *
 * @param {string} tripId - Firestore document ID of the trip
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ days: Array, total_estimated_cost: number }>}
 */
export async function regenerateItinerary(tripId, db) {
  const tripDoc = await db.collection("trips").doc(tripId).get();

  if (!tripDoc.exists) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  const trip = tripDoc.data();

  // Regenerate using the same parameters
  const newItinerary = await generateItinerary({
    destination: trip.destination,
    days: trip.daysCount || trip.days?.length || 3,
    preference: trip.preference || "Adventure",
    budget: trip.budget,
  });

  // Update the Firestore document with the new itinerary
  await db.collection("trips").doc(tripId).update({
    days: newItinerary.days,
    total_estimated_cost: newItinerary.total_estimated_cost,
    regeneratedAt: new Date(),
  });

  console.log(`✅ Trip regenerated: ${tripId}`);
  return newItinerary;
}
