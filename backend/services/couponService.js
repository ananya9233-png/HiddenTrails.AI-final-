/**
 * Coupon Service
 * ----------------
 * Manages the coupon reward system:
 * - Retrieves available coupons
 * - Handles coupon redemption with eligibility checks
 * - Prevents duplicate redemption
 */

import { COUPONS } from "../config/constants.js";

/**
 * Get all available (unredeemed) coupons from Firestore.
 *
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<Array<{ id: string, couponCode: string, pointsRequired: number, ... }>>}
 */
export async function getAvailableCoupons(db) {
  const snapshot = await db
    .collection("coupons")
    .where("isRedeemed", "==", false)
    .get();

  const coupons = [];
  snapshot.forEach((doc) => {
    const data = doc.data();

    // Filter out expired coupons
    if (data.expiryDate && new Date(data.expiryDate) < new Date()) {
      return;
    }

    coupons.push({
      id: doc.id,
      ...data,
    });
  });

  return coupons;
}

/**
 * Redeem a coupon for a user.
 *
 * Validation steps:
 * 1. Coupon exists and is not already redeemed
 * 2. Coupon is not expired
 * 3. User has enough points (minimum 500)
 * 4. User has enough points for this specific coupon
 * 5. User hasn't already redeemed this coupon code
 *
 * @param {string} userId
 * @param {string} couponCode
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ success: boolean, message: string, deductedPoints?: number, remainingPoints?: number }>}
 */
export async function redeemCoupon(userId, couponCode, db) {
  // Step 1: Find the coupon by code
  const couponSnapshot = await db
    .collection("coupons")
    .where("couponCode", "==", couponCode)
    .limit(1)
    .get();

  if (couponSnapshot.empty) {
    return { success: false, message: "Coupon not found" };
  }

  const couponDoc = couponSnapshot.docs[0];
  const coupon = couponDoc.data();

  // Step 2: Check if already redeemed
  if (coupon.isRedeemed) {
    return { success: false, message: "Coupon has already been redeemed" };
  }

  // Step 3: Check expiry
  if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
    return { success: false, message: "Coupon has expired" };
  }

  // Step 4: Check if user has enough points (global minimum)
  const userDoc = await db.collection("users").doc(userId).get();
  const userPoints = userDoc.exists ? userDoc.data().rewardPoints || 0 : 0;

  if (userPoints < COUPONS.MIN_POINTS_FOR_ELIGIBILITY) {
    return {
      success: false,
      message: `Need at least ${COUPONS.MIN_POINTS_FOR_ELIGIBILITY} points to redeem coupons (you have ${userPoints})`,
    };
  }

  // Step 5: Check if user has enough for this specific coupon
  const pointsRequired = coupon.pointsRequired || 0;
  if (userPoints < pointsRequired) {
    return {
      success: false,
      message: `This coupon requires ${pointsRequired} points (you have ${userPoints})`,
    };
  }

  // Step 6: Prevent duplicate redemption by same user
  const duplicateCheck = await db
    .collection("coupons")
    .where("couponCode", "==", couponCode)
    .where("redeemedBy", "==", userId)
    .get();

  if (!duplicateCheck.empty) {
    return {
      success: false,
      message: "You have already redeemed this coupon",
    };
  }

  // Step 7: Execute the redemption
  const newPoints = userPoints - pointsRequired;

  // Update user's points
  await db.collection("users").doc(userId).update({
    rewardPoints: newPoints,
    updatedAt: new Date(),
  });

  // Mark coupon as redeemed
  await couponDoc.ref.update({
    isRedeemed: true,
    redeemedBy: userId,
    redeemedAt: new Date(),
  });

  console.log(
    `✅ Coupon ${couponCode} redeemed by ${userId} (-${pointsRequired} pts)`
  );

  return {
    success: true,
    message: `Coupon "${couponCode}" redeemed successfully!`,
    deductedPoints: pointsRequired,
    remainingPoints: newPoints,
  };
}

/**
 * Get all coupons redeemed by a specific user.
 *
 * @param {string} userId
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<Array>}
 */
export async function getUserCoupons(userId, db) {
  const snapshot = await db
    .collection("coupons")
    .where("redeemedBy", "==", userId)
    .get();

  const coupons = [];
  snapshot.forEach((doc) => {
    coupons.push({ id: doc.id, ...doc.data() });
  });

  return coupons;
}
