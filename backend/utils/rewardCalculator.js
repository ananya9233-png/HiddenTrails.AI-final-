/**
 * Reward Calculator
 * ------------------
 * Calculates trip reward points and enforces daily/monthly caps.
 * Uses logarithmic scaling: points = basePoints * log(totalDistance)
 */

import { REWARDS } from "../config/constants.js";

/**
 * Calculate reward points for a trip based on total distance traveled.
 * Formula: floor(50 * ln(totalDistanceKm))
 *
 * Examples:
 *   15km  → 50 * ln(15)  ≈ 135 points
 *   50km  → 50 * ln(50)  ≈ 195 points
 *   100km → 50 * ln(100) ≈ 230 points (capped at 200/day)
 *
 * @param {number} totalDistanceKm - Total trip distance in kilometers
 * @returns {number} Calculated points (before cap enforcement)
 */
export function calculateRewardPoints(totalDistanceKm) {
  if (totalDistanceKm <= 0) return 0;
  return Math.floor(REWARDS.BASE_POINTS * Math.log(totalDistanceKm));
}

/**
 * Check if the user has exceeded their daily reward cap.
 * Rules:
 *   - Max 1 trip reward claim per 24 hours
 *   - Max 200 points earned per day
 *
 * @param {string} userId
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ allowed: boolean, reason: string, todayPoints: number, todayClaims: number }>}
 */
export async function checkDailyCap(userId, db) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  // Query all rewards claimed by this user today
  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("rewardHistory")
    .where("claimedAt", ">=", dayStart)
    .get();

  let todayPoints = 0;
  let todayClaims = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    todayPoints += data.points || 0;
    todayClaims++;
  });

  // Check claim count limit
  if (todayClaims >= REWARDS.MAX_REWARDS_PER_DAY) {
    return {
      allowed: false,
      reason: `Daily claim limit reached (${REWARDS.MAX_REWARDS_PER_DAY} per day)`,
      todayPoints,
      todayClaims,
    };
  }

  // Check daily points cap
  if (todayPoints >= REWARDS.MAX_POINTS_PER_DAY) {
    return {
      allowed: false,
      reason: `Daily points cap reached (${todayPoints}/${REWARDS.MAX_POINTS_PER_DAY})`,
      todayPoints,
      todayClaims,
    };
  }

  return {
    allowed: true,
    reason: "Within daily limits",
    todayPoints,
    todayClaims,
  };
}

/**
 * Check if the user has exceeded their monthly reward cap.
 * Rule: Max 1000 points per calendar month.
 *
 * @param {string} userId
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ allowed: boolean, reason: string, monthPoints: number }>}
 */
export async function checkMonthlyCap(userId, db) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("rewardHistory")
    .where("claimedAt", ">=", monthStart)
    .get();

  let monthPoints = 0;

  snapshot.forEach((doc) => {
    monthPoints += doc.data().points || 0;
  });

  if (monthPoints >= REWARDS.MAX_POINTS_PER_MONTH) {
    return {
      allowed: false,
      reason: `Monthly points cap reached (${monthPoints}/${REWARDS.MAX_POINTS_PER_MONTH})`,
      monthPoints,
    };
  }

  return {
    allowed: true,
    reason: "Within monthly limits",
    monthPoints,
  };
}
