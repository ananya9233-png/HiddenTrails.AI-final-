/**
 * Coupon Controller
 * -------------------
 * Handles HTTP request/response for coupon operations.
 */

import {
  getAvailableCoupons,
  redeemCoupon,
  getUserCoupons,
} from "../services/couponService.js";
import { db } from "../config/firebase.js";

/**
 * GET /coupons
 *
 * Returns all available (unredeemed, non-expired) coupons.
 * Optionally filters by userId to return user-specific coupons.
 */

export async function handleGetCoupons(req, res) {
  try {
    const { userId } = req.query;

    // If userId is provided, return their redeemed coupons
    if (userId) {
      const userCoupons = await getUserCoupons(userId, db);
      return res.json({ coupons: userCoupons });
    }

    // Otherwise return all available coupons
    const coupons = await getAvailableCoupons(db);
    res.json({ coupons });
  } catch (error) {
    console.error("❌ Get coupons error:", error);
    res.status(500).json({ error: "Failed to retrieve coupons" });
  }
}

/**
 * POST /coupon/redeem
 *
 * Redeems a coupon code for the authenticated user.
 * Deducts points and marks the coupon as used.
 *
 * Expected body:
 * {
 *   userId: string,
 *   couponCode: string
 * }
 */

export async function handleRedeemCoupon(req, res) {
  try {
    const { userId, couponCode } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!couponCode) {
      return res.status(400).json({ error: "Coupon code is required" });
    }

    const result = await redeemCoupon(userId, couponCode, db);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("❌ Redeem coupon error:", error);
    res.status(500).json({ error: "Failed to redeem coupon" });
  }
}