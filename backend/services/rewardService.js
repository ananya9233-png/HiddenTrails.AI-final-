/**
 * Reward Service
 * ----------------
 * Manages reward points: awarding, cap enforcement, level updates.
 * Supports both photo challenge rewards and trip-based rewards.
 */

import {
  calculateRewardPoints,
  checkDailyCap,
  checkMonthlyCap,
} from "../utils/rewardCalculator.js";
import { getLevel, calculateProgress } from "../utils/levelCalculator.js";
import { validateTrip } from "./gpsService.js";
import { PHOTO_CHALLENGE } from "../config/constants.js";

/**
 * Award points for a successful photo challenge completion.
 * Updates user's total points, level, and logs the reward history.
 *
 * @param {string} userId
 * @param {string} challengeId - e.g., "tajmahal", "indiagate"
 * @param {number} points      - Points to award
 * @param {{ landmarkMatchScore: number, livenessScore: number }} verificationResult
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ success: boolean, totalPoints: number, level: object }>}
 */
export async function awardPhotoPoints(
  userId,
  challengeId,
  points,
  verificationResult,
  db
) {
  // Save the completed challenge record
  await db.collection("photoChallenges").add({
    userId,
    challengeId,
    pointsAwarded: points,
    landmarkMatchScore: verificationResult.landmarkMatchScore,
    livenessScore: verificationResult.livenessScore,
    completedAt: new Date(),
  });

  // Update user's total points
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  let currentPoints = 0;
  if (userDoc.exists) {
    currentPoints = userDoc.data().rewardPoints || 0;
  }

  const newTotal = currentPoints + points;
  const newLevel = getLevel(newTotal);

  // Upsert user document with updated points and level
  await userRef.set(
    {
      rewardPoints: newTotal,
      level: newLevel.name,
      levelNumber: newLevel.level,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  // Log reward history for cap checking
  await userRef.collection("rewardHistory").add({
    type: "photo_challenge",
    challengeId,
    points,
    claimedAt: new Date(),
  });

  console.log(
    `✅ Photo reward: +${points} pts for ${userId} (${challengeId}) → Total: ${newTotal}`
  );

  return {
    success: true,
    totalPoints: newTotal,
    level: newLevel,
  };
}

/**
 * Award points for a validated real-world trip.
 * Validates the trip, checks caps, calculates points, and updates the user.
 *
 * @param {string} userId
 * @param {{ gpsPoints: Array, visitedPOIs: Array }} tripData
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ success: boolean, points: number, totalPoints: number, level: object, errors?: string[] }>}
 */
export async function awardTripReward(userId, tripData, db) {
  // Step 1: Validate the trip meets minimum criteria
  const tripValidation = validateTrip(tripData);
  if (!tripValidation.valid) {
    return {
      success: false,
      points: 0,
      errors: tripValidation.errors,
    };
  }

  // Step 2: Check daily cap
  const dailyCheck = await checkDailyCap(userId, db);
  if (!dailyCheck.allowed) {
    return {
      success: false,
      points: 0,
      errors: [dailyCheck.reason],
    };
  }

  // Step 3: Check monthly cap
  const monthlyCheck = await checkMonthlyCap(userId, db);
  if (!monthlyCheck.allowed) {
    return {
      success: false,
      points: 0,
      errors: [monthlyCheck.reason],
    };
  }

  // Step 4: Calculate reward points (capped at daily maximum remaining)
  let points = calculateRewardPoints(tripValidation.stats.totalDistanceKm);
  const dailyRemaining = 200 - dailyCheck.todayPoints;
  const monthlyRemaining = 1000 - monthlyCheck.monthPoints;
  points = Math.min(points, dailyRemaining, monthlyRemaining);

  if (points <= 0) {
    return {
      success: false,
      points: 0,
      errors: ["Points cap reached for the current period"],
    };
  }

  // Step 5: Update user's total points and level
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  let currentPoints = 0;
  if (userDoc.exists) {
    currentPoints = userDoc.data().rewardPoints || 0;
  }

  const newTotal = currentPoints + points;
  const newLevel = getLevel(newTotal);

  await userRef.set(
    {
      rewardPoints: newTotal,
      level: newLevel.name,
      levelNumber: newLevel.level,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  // Step 6: Log reward history
  await userRef.collection("rewardHistory").add({
    type: "trip_reward",
    points,
    tripStats: tripValidation.stats,
    claimedAt: new Date(),
  });

  console.log(
    `✅ Trip reward: +${points} pts for ${userId} → Total: ${newTotal}`
  );

  return {
    success: true,
    points,
    totalPoints: newTotal,
    level: newLevel,
    tripStats: tripValidation.stats,
  };
}

/**
 * Get the current reward status for a user.
 *
 * @param {string} userId
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ points: number, level: object, progress: object, completedChallenges: string[] }>}
 */
export async function getUserRewards(userId, db) {
  const userDoc = await db.collection("users").doc(userId).get();

  let points = 0;
  if (userDoc.exists) {
    points = userDoc.data().rewardPoints || 0;
  }

  const level = getLevel(points);
  const progress = calculateProgress(points);

  // Get list of completed photo challenges
  const challengeSnap = await db
    .collection("photoChallenges")
    .where("userId", "==", userId)
    .get();

  const completedChallenges = [];
  challengeSnap.forEach((doc) => {
    completedChallenges.push(doc.data().challengeId);
  });

  return {
    points,
    level,
    progress,
    completedChallenges,
  };
}
