/**
 * Coupon Seeder
 * ---------------
 * Seeds the Firestore "coupons" collection with sample coupons
 * if none exist. Runs once on server startup.
 */

import { db } from "../config/firebase.js";

const SAMPLE_COUPONS = [
  {
    couponCode: "TRAIL10",
    title: "10% Off Hotel Booking",
    description: "Get 10% off on any hotel booking via our partner hotels across India.",
    brand: "HiddenTrails Hotels",
    pointsRequired: 200,
    discount: "10%",
    category: "Hotels",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    couponCode: "ADVENTURE500",
    title: "₹500 Off Adventure Activity",
    description: "Save ₹500 on any adventure activity — rafting, trekking, paragliding & more.",
    brand: "Thrillophilia",
    pointsRequired: 500,
    discount: "₹500",
    category: "Adventure",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    couponCode: "ECOSTAY20",
    title: "20% Off Eco-Stay",
    description: "20% discount on eco-friendly homestays and sustainable lodges.",
    brand: "EcoStay India",
    pointsRequired: 350,
    discount: "20%",
    category: "Stays",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    couponCode: "FOODIE250",
    title: "₹250 Off Food Tour",
    description: "Flat ₹250 off on a local food tour experience in any city.",
    brand: "Local Bites",
    pointsRequired: 250,
    discount: "₹250",
    category: "Food",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    couponCode: "BUSPASS15",
    title: "15% Off Bus Tickets",
    description: "15% off on inter-city bus tickets. Valid for all routes.",
    brand: "RedBus",
    pointsRequired: 300,
    discount: "15%",
    category: "Transport",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    couponCode: "HERITAGE100",
    title: "Free Museum Entry",
    description: "Free entry to any ASI heritage site or museum. Covers up to ₹100 ticket cost.",
    brand: "ASI India",
    pointsRequired: 150,
    discount: "₹100",
    category: "Heritage",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    couponCode: "TRAINOFF",
    title: "₹200 Off Train Booking",
    description: "₹200 off on your next train ticket booking via IRCTC partners.",
    brand: "RailYatri",
    pointsRequired: 400,
    discount: "₹200",
    category: "Transport",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    couponCode: "CAMPFIRE",
    title: "Free Night Camping",
    description: "One free night of camping at any partner campsite across India.",
    brand: "Camp Wild",
    pointsRequired: 600,
    discount: "Free Night",
    category: "Adventure",
    expiryDate: "2026-12-31",
    isRedeemed: false,
    redeemedBy: null,
    redeemedAt: null,
  },
];

/**
 * Seed sample coupons to Firestore if the collection is empty.
 * Call this on server startup.
 */
export async function seedCoupons() {
  try {
    const snapshot = await db.collection("coupons").limit(1).get();

    if (!snapshot.empty) {
      console.log("🎟️  Coupons already seeded, skipping.");
      return;
    }

    const batch = db.batch();
    for (const coupon of SAMPLE_COUPONS) {
      const docRef = db.collection("coupons").doc();
      batch.set(docRef, {
        ...coupon,
        createdAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    console.log(`🎟️  Seeded ${SAMPLE_COUPONS.length} sample coupons to Firestore!`);
  } catch (err) {
    console.error("⚠️ Coupon seeding error:", err.message);
  }
}
