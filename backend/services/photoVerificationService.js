/**
 * Photo Verification Service
 * ----------------------------
 * Uses Groq LLaMA 4 Scout (multimodal vision model) to verify:
 * 1. Landmark Match — Does the photo show the correct landmark?
 * 2. Liveness — Was the photo taken live (not a screenshot/copy)?
 *
 * Returns structured scores for both checks.
 */

import fetch from "node-fetch";
import {
  GROQ_BASE_URL,
  getGroqHeaders,
  LLAMA_VISION_MODEL,
} from "../config/groq.js";

/**
 * Verify a user's photo against a reference image using AI vision.
 *
 * @param {string} userImageBase64    - Base64-encoded user photo (data:image/jpeg;base64,...)
 * @param {string} referenceImageUrl  - URL of the reference landmark image
 * @param {string} landmarkName       - Human-readable name (e.g., "Taj Mahal in Agra")
 * @returns {Promise<{ landmarkMatchScore: number, livenessScore: number, match: boolean, liveness: boolean, reason: string }>}
 */
export async function verifyPhoto(
  userImageBase64,
  referenceImageUrl,
  landmarkName
) {
  // Convert reference image URL to base64 (Groq may not fetch external URLs)
  let referenceBase64 = referenceImageUrl;
  if (referenceImageUrl && !referenceImageUrl.startsWith("data:")) {
    try {
      const imgRes = await fetch(referenceImageUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.buffer();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        referenceBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
        console.log("✅ Reference image converted to base64");
      }
    } catch (err) {
      console.warn("⚠️ Could not convert reference image to base64:", err.message);
      // Keep the URL as fallback
    }
  }

  const response = await fetch(GROQ_BASE_URL, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify({
      model: LLAMA_VISION_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an image verification AI for a travel challenge app. The user is asked to take a real-time webcam photo of ${landmarkName}. You must verify TWO things:
1. MATCH — Does the user's photo show the same landmark / location as the reference image?
2. LIVENESS — Does the user's photo look like it was taken live with a camera/webcam (natural lighting, slight blur, real-world perspective) rather than being a screenshot, photo-of-a-screen, or digitally copied image?

Respond ONLY in this exact JSON format, no other text:
{"match": true/false, "liveness": true/false, "landmarkMatchScore": 0-100, "livenessScore": 0-100, "confidence": 0-100, "reason": "brief reason"}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Reference image is of ${landmarkName}. Compare the user's photo (second image) with the reference (first image). Check if they show the same place and if the user photo looks like a real live capture. Provide numerical scores for both match and liveness.`,
            },
            {
              type: "image_url",
              image_url: { url: referenceBase64 },
            },
            {
              type: "image_url",
              image_url: { url: userImageBase64 },
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.1, // Low temperature for deterministic verification
    }),
  });

  const data = await response.json();

  // Log errors from the API
  if (data.error) {
    console.error("❌ Groq API error:", JSON.stringify(data.error));
  }

  const aiText = data.choices?.[0]?.message?.content || "";

  console.log("📝 Vision AI response:", aiText);

  return parseVerificationResponse(aiText);
}

/**
 * Parse the AI vision response into structured verification data.
 * Includes regex JSON extraction and keyword-based fallback.
 *
 * @param {string} aiText - Raw text from the vision model
 * @returns {{ landmarkMatchScore: number, livenessScore: number, match: boolean, liveness: boolean, confidence: number, reason: string }}
 */
function parseVerificationResponse(aiText) {
  try {
    // Extract JSON from the response (AI may include extra text)
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        landmarkMatchScore: parsed.landmarkMatchScore ?? (parsed.match ? 85 : 20),
        livenessScore: parsed.livenessScore ?? (parsed.liveness ? 80 : 25),
        match: !!parsed.match,
        liveness: !!parsed.liveness,
        confidence: parsed.confidence || 50,
        reason: parsed.reason || "AI verification completed",
      };
    }
    throw new Error("No JSON found in AI vision response");
  } catch (parseErr) {
    console.error("❌ Vision JSON parse error:", parseErr.message);

    // Fallback: keyword-based analysis when JSON parsing fails
    const lowerText = aiText.toLowerCase();
    const match =
      lowerText.includes("match") &&
      !lowerText.includes("not match") &&
      !lowerText.includes("no match");
    const liveness =
      lowerText.includes("live") && !lowerText.includes("not live");

    return {
      landmarkMatchScore: match ? 60 : 20,
      livenessScore: liveness ? 60 : 20,
      match,
      liveness,
      confidence: 40,
      reason: aiText.slice(0, 200) || "Fallback analysis used",
    };
  }
}
