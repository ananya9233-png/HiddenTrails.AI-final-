/**
 * Coupon Routes
 * ---------------
 * GET  /coupons          — Get available or user-specific coupons
 * POST /coupon/redeem    — Redeem a coupon code
 */

import { Router } from "express";
import {
  handleGetCoupons,
  handleRedeemCoupon,
} from "../controllers/couponController.js";

const router = Router();

router.get("/coupons", handleGetCoupons);
router.post("/coupon/redeem", handleRedeemCoupon);

export default router;
