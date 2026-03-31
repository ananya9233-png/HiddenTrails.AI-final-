/**
 * Photo Verification Service
 * ----------------------------
 * Uses Groq LLaMA 4 Scout (multimodal vision model) to verify:
 * 1. Landmark Match — Does the photo show the correct landmark?
 * 2. Liveness — Was the photo taken live (not a screenshot/copy)?
 */

import fetch from "node-fetch";
import https from "https";
import sharp from "sharp";
import {
  GROQ_BASE_URL,
  getGroqHeaders,
  LLAMA_VISION_MODEL,
} from "../config/groq.js";

// Bypasses SSL verification for image fetching (needed for Wikipedia CDN URLs)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Resize + compress image buffer to stay under Groq's request size limit
async function compressImageBuffer(buffer) {
  return sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export async function verifyPhoto(
  userImageBase64,
  referenceImageUrl,
  landmarkName,
  isGalleryUpload = false
) {
  // ── Fetch + compress reference image ──────────────────────────────────────
  let referenceBase64 = null;
  if (referenceImageUrl && !referenceImageUrl.startsWith("data:")) {
    try {
      const imgRes = await fetch(referenceImageUrl, { agent: httpsAgent });
      if (imgRes.ok) {
        const rawBuffer = await imgRes.arrayBuffer();
        const compressed = await compressImageBuffer(Buffer.from(rawBuffer));
        referenceBase64 = `data:image/jpeg;base64,${compressed.toString("base64")}`;
        console.log("✅ Reference image ready, size:", Math.round(compressed.length / 1024), "KB");
      } else {
        console.warn("⚠️ Reference image fetch failed — HTTP", imgRes.status);
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch reference image:", err.message);
    }
  } else if (referenceImageUrl?.startsWith("data:")) {
    referenceBase64 = referenceImageUrl;
  }

  // Clean early abort — fixed: no undefined variable references
  if (!referenceBase64) {
    console.error("❌ Reference image unavailable — aborting verification");
    return {
      landmarkMatchScore: 0,
      livenessScore: 0,
      confidence: 0,
      match: false,
      liveness: false,
      reason: "Reference image could not be loaded. Please try again.",
    };
  }

  // Gallery-aware liveness context injected into AI prompt
  const livenessContext = isGalleryUpload
    ? `IMPORTANT: The user uploaded this from their photo GALLERY — it was NOT taken live right now.
       This could be a photo downloaded from Google Images, Wikipedia, or any website.
       Score liveness LOW (10-40) unless you see clear evidence it was personally taken
       (e.g. selfie with landmark, visible hands/shadow, unconventional angle).
       A professional/stock-looking photo MUST score liveness below 40.`
    : `The user claims this was captured LIVE via their device camera right now.
       Look for signs of a live capture: natural imperfections, slight motion blur, phone camera
       artifacts, unconventional framing, shadows, or personal elements.
       A perfect, professionally composed, stock-photo-quality image submitted as live
       is suspicious — score liveness lower (40-60).
       Only score liveness 70+ if the image has clear signs of being personally taken.`;

  const response = await fetch(GROQ_BASE_URL, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify({
      model: LLAMA_VISION_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a strict photo verification AI for a travel gamification app called HiddenTrails.
Users must PHYSICALLY VISIT landmarks and take photos there to earn points. Your job is to prevent cheating.

You must verify TWO things:

1. LOCATION MATCH — Does the user's photo show the SAME LANDMARK as the reference image?
   - Focus only on whether it is the same place, building, or monument
   - Ignore differences in angle, lighting, weather, zoom, or season
   - Score 0-100. Score 70+ only if clearly the same landmark.
   - Score below 30 if it is a completely different place

2. LIVENESS — Is this photo personally taken by the user, or downloaded from the internet?
   SIGNS OF A DOWNLOADED/GOOGLE IMAGE (score liveness LOW: 0-40):
   - Perfect professional composition and framing
   - Looks identical or near-identical to the reference image
   - Stock-photo or Wikipedia-quality appearance
   - No personal elements at all
   SIGNS OF A GENUINE LIVE PHOTO (score liveness HIGH: 60-100):
   - Natural imperfections, slight blur, or grain
   - Unconventional angle or personal framing
   - Clearly different composition from the reference image
   - Phone camera artifacts

${livenessContext}

ALWAYS give a clear human-readable explanation in "reason" describing what you see in BOTH images.
Good reason examples:
  "Both images show the same white domed shrine near water. The user photo appears to be a downloaded stock image."
  "The reference shows Haji Ali Dargah (white building near sea) but the user submitted a red mosque — different landmark."
  "The user photo clearly shows the Gateway of India arch from a personal angle with crowd visible."

Respond ONLY in this exact JSON format, no other text:
{"match": true/false, "liveness": true/false, "landmarkMatchScore": 0-100, "livenessScore": 0-100, "confidence": 0-100, "reason": "clear explanation of what you see in both images"}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Reference image (first): shows ${landmarkName}. User submission (second): is this the same landmark, and is it a personally taken photo or downloaded from internet? Be specific about what you see in both images.`,
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
      max_tokens: 250,
      temperature: 0.1,
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("❌ Groq API error:", JSON.stringify(data.error));
  }

  const aiText = data.choices?.[0]?.message?.content || "";
  console.log("📝 Vision AI response:", aiText);

  return parseVerificationResponse(aiText);
}

function parseVerificationResponse(aiText) {
  try {
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