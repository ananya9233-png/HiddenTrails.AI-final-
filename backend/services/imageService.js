/**
 * Image Service
 * ---------------
 * Fetches destination images using the free Wikipedia/Wikimedia API.
 * No API key required!
 *
 * Strategy:
 *   1. Search Wikipedia for the landmark/destination
 *   2. Grab the main page image (thumbnail) from the page summary API
 *   3. Fall back to a generic travel image if nothing found
 */

import fetch from "node-fetch";

// Fallback image (a beautiful generic landscape)
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=400&fit=crop";

// Common fluff words to strip from queries for better Wikipedia matches
const STRIP_WORDS =
  /\b(travel|photography|day|morning|afternoon|evening|vibes|trip|explore|visit|arrival|departure|and|the|in|at|of|to|a|an|with|for|from|bustling|beautiful|famous|iconic|historic|nearby|local|popular|ancient|renowned|magnificent|stunning|traditional|old|new|great)\b/gi;

// In-memory cache: { query -> { url, timestamp } }
// Avoids re-fetching the same image from Wikipedia on every request
const imageCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get a relevant image for a destination/query using Wikipedia.
 * Results are cached in memory for fast repeated lookups.
 *
 * @param {string} query - Search query (e.g., "Rumi Darwaza lucknow")
 * @returns {Promise<string>} Image URL
 */
export async function getDestinationImage(query) {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  const cached = imageCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log("⚡ Cache hit for:", query);
    return cached.url;
  }

  try {
    const searchTerms = buildSearchStrategies(query);
    console.log("🖼️ Wikipedia image search strategies:", searchTerms);

    for (const term of searchTerms) {
      if (!term || term.length < 2) continue;

      // Strategy A: Try the Wikipedia page summary API (gives a nice thumbnail)
      const image = await fetchWikipediaSummaryImage(term);
      if (image) {
        imageCache.set(cacheKey, { url: image, timestamp: Date.now() });
        return image;
      }

      // Strategy B: Try Wikipedia image search API
      const image2 = await fetchWikipediaImageSearch(term);
      if (image2) {
        imageCache.set(cacheKey, { url: image2, timestamp: Date.now() });
        return image2;
      }
    }

    console.log("⚠️ No image found for:", query);
    return FALLBACK_IMAGE;
  } catch (error) {
    console.error("Image fetch error:", error.message);
    return FALLBACK_IMAGE;
  }
}

/**
 * Build search strategies — progressively more general.
 */
function buildSearchStrategies(query) {
  // Strip fluff words
  const cleaned = query
    .replace(STRIP_WORDS, "")
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((w) => w.length > 2);

  if (words.length === 0) return [query.trim()];
  if (words.length === 1) return [words[0]];

  // Identify destination (usually last word) vs landmark (other words)
  const destination = words[0]; 
const landmarkWords = words.slice(1);
 

  const strategies = [];

  // Strategy 1: Full cleaned query
  strategies.push(cleaned);

  // Strategy 2: Landmark + destination
  if (landmarkWords.length > 0) {
    strategies.push(landmarkWords.join(" ") + " " + destination);
  }

  // Strategy 3: Just landmark name
  if (landmarkWords.length > 0) {
    strategies.push(landmarkWords.join(" "));
  }

  // Strategy 4: destination + first landmark word
  if (landmarkWords.length > 0) {
    strategies.push(destination + " " + landmarkWords[0]);
  }

  // Strategy 5: Just destination
  strategies.push(destination);

  return [...new Set(strategies)];
}

/**
 * Fetch the main image from a Wikipedia page summary.
 * Uses the REST API: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
 *
 * This is the best approach — it returns the main thumbnail for a Wikipedia article.
 */
async function fetchWikipediaSummaryImage(searchTerm) {
  try {
    // Step 1: Search Wikipedia for the best matching article title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(searchTerm)}&limit=3&format=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    // opensearch returns: [query, [titles], [descriptions], [urls]]
    const titles = searchData[1];
    if (!titles || titles.length === 0) return null;

    // Step 2: Try each matching title's page summary for an image
    for (const title of titles) {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summaryRes = await fetch(summaryUrl);
      if (!summaryRes.ok) continue;

      const summaryData = await summaryRes.json();

      // The "originalimage" or "thumbnail" field has the image
      const imageUrl =
        summaryData.originalimage?.source || summaryData.thumbnail?.source;

        if (imageUrl && !title.includes("born") && !title.includes("film")) {
            console.log("✅ Wikipedia image found for:", searchTerm, "→", title);
            return imageUrl;
        }
    }
    

    return null;
  } catch (err) {
    console.warn("Wikipedia summary fetch error:", err.message);
    return null;
  }
}

/**
 * Fallback: search for images using the Wikipedia image query API.
 * Uses action=query with prop=pageimages.
 */
async function fetchWikipediaImageSearch(searchTerm) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTerm)}&prop=pageimages&format=json&pithumbsize=800&redirects=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    for (const pageId of Object.keys(pages)) {
      if (pageId === "-1") continue; // Page not found
      const thumb = pages[pageId]?.thumbnail?.source;
      if (thumb) {
        console.log("✅ Wikipedia image (query API) found for:", searchTerm);
        return thumb;
      }
    }

    return null;
  } catch (err) {
    console.warn("Wikipedia image query error:", err.message);
    return null;
  }
}
