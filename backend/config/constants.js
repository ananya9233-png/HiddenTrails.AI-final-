/**
 * Application Constants
 * ----------------------
 * All business logic thresholds, limits, and configuration values.
 * Centralizing these makes the codebase easy to tune without hunting through services.
 */

// ==================== GPS VALIDATION ====================

export const GPS = {
  MAX_PROXIMITY_METERS: 150,        // User must be within 150m of POI
  MAX_SPEED_KMH: 150,               // Reject if speed exceeds 150 km/h
  TELEPORT_DISTANCE_KM: 20,         // Reject if user jumps >20km
  TELEPORT_WINDOW_MINUTES: 5,       // ...within a 5-minute window
  EARTH_RADIUS_KM: 6371,            // Earth's mean radius for Haversine
};

// ==================== TRIP VALIDATION ====================

export const TRIP = {
  MIN_DISTANCE_KM: 15,              // Trip must cover at least 15km
  MIN_DURATION_HOURS: 2,            // Trip must last at least 2 hours
  MIN_UNIQUE_POIS: 3,               // Must visit at least 3 unique POIs
  MIN_POI_STAY_MINUTES: 5,          // Must stay at each POI for at least 5 minutes
};

// ==================== REWARD SYSTEM ====================

export const REWARDS = {
  BASE_POINTS: 50,                   // Base multiplier: points = 50 * log(distance)
  MAX_REWARDS_PER_DAY: 1,           // Max 1 trip reward claim per 24 hours
  MAX_POINTS_PER_DAY: 200,          // Daily points cap
  MAX_POINTS_PER_MONTH: 1000,       // Monthly points cap
};

// ==================== LEVELING SYSTEM ====================

export const LEVELS = [
  { name: "Rookie",       min: 0,    max: 200  },
  { name: "Explorer",     min: 200,  max: 500  },
  { name: "Adventurer",   min: 500,  max: 1000 },
  { name: "Pro Traveler", min: 1000, max: 2000 },
  { name: "Legend",       min: 2000, max: Infinity },
];

// ==================== COUPON SYSTEM ====================

export const COUPONS = {
  MIN_POINTS_FOR_ELIGIBILITY: 500,   // Minimum points required to redeem any coupon
};

// ==================== PHOTO CHALLENGE ====================

export const PHOTO_CHALLENGE = {
  MIN_LANDMARK_MATCH_SCORE: 75,      // Landmark match must be >75 out of 100
  MIN_LIVENESS_SCORE: 70,            // Liveness check must be >70 out of 100

  // Point values per challenge difficulty
  POINTS: {
    tajmahal: 150,
    goldentemple: 150,
    mysorepalace: 140,
    hawamahal: 130,
    gateway: 120,
    indiagate: 100,
  },

  // Human-readable names for AI prompts
  LANDMARK_NAMES: {
    tajmahal: "Taj Mahal in Agra",
    indiagate: "India Gate in New Delhi",
    gateway: "Gateway of India in Mumbai",
    hawamahal: "Hawa Mahal in Jaipur",
    mysorepalace: "Mysore Palace in Mysore",
    goldentemple: "Golden Temple in Amritsar",
  },

  PARTIAL_MATCH_POINTS: 30,          // Points for match without liveness
};

// ==================== CHATBOT ====================

export const CHATBOT = {
  MAX_HISTORY_LENGTH: 20,            // Keep last 20 messages to prevent token overflow
  MAX_TOKENS: 120,                   // Max response tokens
  TEMPERATURE: 0.7,                  // Creativity setting
};

// ==================== ITINERARY ====================

export const ITINERARY = {
  MAX_TOKENS: 2000,                  // Max tokens for itinerary generation
  TEMPERATURE: 0.7,
};
