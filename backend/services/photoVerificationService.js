/**
 * Photo Verification Service
 * ----------------------------
 * Uses Groq LLaMA 4 Scout (multimodal vision model) to verify:
 * 1. Landmark Match — Does the photo show the correct landmark?
 * 2. Liveness — Was the photo taken live (not a screenshot/copy)?
 *
 * DEMO MODE (banasthali challenge):
 *  - Live photo: ONLY passes if the dept building facade is clearly visible.
 *                A person, room, sky, or random scene → rejected (match = false).
 *  - Gallery upload: ONLY passes if the image URL matches one of the
 *                    pre-approved known building photos list sent from frontend.
 *                    Any other photo → rejected.
 */

import fetch from "node-fetch";
import https from "https";
import sharp from "sharp";
import {
  GROQ_BASE_URL,
  getGroqHeaders,
  LLAMA_VISION_MODEL,
} from "../config/groq.js";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function compressImageBuffer(buffer) {
  return sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEMO GALLERY CHECK
//  Checks if the uploaded gallery image is one of the known building photos.
//  We compare by fetching each known image and doing a pixel-level hash check,
//  OR (simpler & sufficient) by checking if the data URI prefix matches after
//  fetching the known URLs and re-encoding them.
//  For simplicity and speed we do a base64 prefix comparison (first 500 chars
//  of the image data) which is unique enough to distinguish photos.
// ─────────────────────────────────────────────────────────────────────────────
async function isDemoKnownBuildingImage(userImageBase64, knownImageUrls = []) {
  if (!knownImageUrls || knownImageUrls.length === 0) return false;

  // Extract raw base64 data from the user image data URI
  const userDataPart = userImageBase64.replace(/^data:image\/\w+;base64,/, "");
  // Use first 800 chars as a fingerprint (enough to distinguish photos)
  const userFingerprint = userDataPart.slice(0, 800);

  for (const url of knownImageUrls) {
    try {
      const res = await fetch(url, { agent: httpsAgent });
      if (!res.ok) continue;
      const raw = await res.arrayBuffer();
      const compressed = await compressImageBuffer(Buffer.from(raw));
      const knownBase64 = compressed.toString("base64");
      const knownFingerprint = knownBase64.slice(0, 800);

      // Allow ~10% tolerance in fingerprint similarity for JPEG re-encoding differences
      const matchLen = [...userFingerprint].filter((c, i) => c === knownFingerprint[i]).length;
      const similarity = matchLen / userFingerprint.length;
      console.log(`🔍 Gallery fingerprint similarity vs ${url.slice(-30)}: ${(similarity * 100).toFixed(1)}%`);

      if (similarity > 0.85) {
        console.log("✅ Demo gallery: known building photo matched");
        return true;
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch known image for comparison:", err.message);
    }
  }

  console.log("❌ Demo gallery: image does NOT match any known building photo");
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN VERIFY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyPhoto(
  userImageBase64,
  referenceImageUrl,
  landmarkName,
  isGalleryUpload = false,
  demoMode = false,
  demoKnownImages = []
) {
  // ── DEMO GALLERY: strict known-image check, no AI needed ──────────────────
  if (demoMode && isGalleryUpload) {
    const isKnown = await isDemoKnownBuildingImage(userImageBase64, demoKnownImages);
    if (isKnown) {
      return {
        landmarkMatchScore: 90,
        livenessScore: 50,   // gallery so liveness is moderate — controller decides points
        match: true,
        liveness: false,     // gallery upload → no live credit
        confidence: 90,
        reason: "Gallery photo matches a known photo of the Banasthali Vidyapeeth dept building.",
        demoGalleryMatch: true,
      };
    } else {
      return {
        landmarkMatchScore: 5,
        livenessScore: 0,
        match: false,
        liveness: false,
        confidence: 95,
        reason: "This gallery image is not one of the approved photos of the dept building. Only photos you personally took of the building are accepted in demo mode.",
        demoGalleryMatch: false,
      };
    }
  }

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
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch reference image:", err.message);
    }
  } else if (referenceImageUrl?.startsWith("data:")) {
    referenceBase64 = referenceImageUrl;
  }

  if (!referenceBase64) {
    return {
      landmarkMatchScore: 0, livenessScore: 0, confidence: 0,
      match: false, liveness: false,
      reason: "Reference image could not be loaded. Please try again.",
    };
  }

  // ── Build the AI prompt ───────────────────────────────────────────────────
  let systemPrompt;
  let userPrompt;

  if (demoMode) {
    // ── DEMO LIVE PHOTO: ultra-strict — must see the actual building ─────────
    systemPrompt = `You are a strict photo verification AI for a campus challenge demo.

The target is the BANASTHALI VIDYAPEETH DEPT BUILDING — a specific multi-storey academic building
with a light-colored (white/cream/beige) facade, multiple floors, rectangular windows, and campus surroundings.

YOUR ONLY JOB: Does the user's photo clearly show THIS BUILDING (or a very similar campus building facade)?

STRICT REJECTION RULES — score landmarkMatchScore BELOW 20 and match=false if:
  • The photo shows a PERSON or people (even partially)
  • The photo shows an INDOOR ROOM, ceiling, floor, desk, furniture
  • The photo shows a BLANK WALL, sky, ground, grass only
  • The photo shows a PHONE SCREEN, screenshot, or another camera
  • The photo shows ANY building that is clearly NOT a multi-storey academic/institutional building
  • The photo is too dark, too close, or unrecognizable as a building exterior

ACCEPT (score landmarkMatchScore 65+, match=true) ONLY IF:
  • The photo clearly shows the exterior facade of a multi-storey campus/institutional building
  • The building has visible floors, windows, and academic building characteristics
  • It resembles the reference image (light-colored multi-storey building)

Liveness scoring (live demo capture):
  • Score livenessScore 60+ if the photo has natural camera artifacts (slight grain, imperfect framing, ambient lighting)
  • Score livenessScore below 40 if it looks like a professionally downloaded stock photo

Respond ONLY in this exact JSON format:
{"match": true/false, "liveness": true/false, "landmarkMatchScore": 0-100, "livenessScore": 0-100, "confidence": 0-100, "reason": "one sentence describing what you see"}`;

    userPrompt = `Reference image (first): the Banasthali Vidyapeeth dept building exterior.
User live capture (second): does it show the BUILDING EXTERIOR? Reject if it shows a person, room, wall, sky, or anything that is not clearly a multi-storey academic building facade.`;

  } else {
    // ── REGULAR challenges ────────────────────────────────────────────────────
    const livenessContext = isGalleryUpload
      ? `IMPORTANT: The user uploaded this from their photo GALLERY — it was NOT taken live right now.
         Score liveness LOW (10-40) unless you see clear evidence it was personally taken.
         A professional/stock-looking photo MUST score liveness below 40.`
      : `The user claims this was captured LIVE via their device camera right now.
         Look for signs of a live capture: natural imperfections, slight blur, phone camera artifacts.
         Score liveness 70+ only if the image has clear signs of being personally taken.`;

    systemPrompt = `You are a strict photo verification AI for a travel gamification app called HiddenTrails.
Users must PHYSICALLY VISIT landmarks and take photos there to earn points.

Verify TWO things:

1. LOCATION MATCH — Does the user's photo show the SAME LANDMARK as the reference image?
   Score 0-100. Score 70+ only if clearly the same landmark. Score below 30 if different place.

2. LIVENESS — Is this photo personally taken, or downloaded from the internet?
   DOWNLOADED (liveness LOW 0-40): perfect professional composition, identical to reference, stock-photo quality.
   GENUINE LIVE (liveness HIGH 60-100): natural imperfections, unconventional angle, phone artifacts.

${livenessContext}

Respond ONLY in this exact JSON format:
{"match": true/false, "liveness": true/false, "landmarkMatchScore": 0-100, "livenessScore": 0-100, "confidence": 0-100, "reason": "clear explanation of what you see in both images"}`;

    userPrompt = `Reference image (first): shows ${landmarkName}. User submission (second): is this the same landmark, and is it a personally taken photo or downloaded from internet?`;
  }

  // ── Call Groq Vision API ──────────────────────────────────────────────────
  const response = await fetch(GROQ_BASE_URL, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify({
      model: LLAMA_VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: referenceBase64 } },
            { type: "image_url", image_url: { url: userImageBase64 } },
          ],
        },
      ],
      max_tokens: 250,
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  if (data.error) console.error("❌ Groq API error:", JSON.stringify(data.error));

  const aiText = data.choices?.[0]?.message?.content || "";
  console.log(`📝 Vision AI response [demo=${demoMode}]:`, aiText);

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
    const match = lowerText.includes("match") && !lowerText.includes("not match") && !lowerText.includes("no match");
    const liveness = lowerText.includes("live") && !lowerText.includes("not live");
    return {
      landmarkMatchScore: match ? 60 : 20,
      livenessScore: liveness ? 60 : 20,
      match, liveness, confidence: 40,
      reason: aiText.slice(0, 200) || "Fallback analysis used",
    };
  }
}