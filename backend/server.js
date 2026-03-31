/**
 * ═══════════════════════════════════════════════════════════════
 *  HiddenTrails.AI — Production Backend Server
 * ═══════════════════════════════════════════════════════════════
 *
 *  A modular Express.js backend powering the HiddenTrails.AI
 *  eco-travel platform. Features include:
 *
 *  1. AI Itinerary Generation (Groq LLaMA 3.1)
 *  2. AI Travel Chatbot with conversation memory
 *  3. Photo Challenge with GPS + Vision verification (LLaMA 4 Scout)
 *  4. Trip-based Reward System with daily/monthly caps
 *  5. Leveling System (Rookie → Legend)
 *  6. Coupon Redemption System
 *  7. Destination Image API (Wikipedia)
 *
 *  Architecture: Controllers → Services → Utils → Config
 *  Database: Firebase Firestore (via Admin SDK)
 *  AI Provider: Groq API
 *
 * ═══════════════════════════════════════════════════════════════
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables FIRST
dotenv.config();

// ── Middleware ──
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

// ── Routes ──
import itineraryRoutes from "./routes/itineraryRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import photoRoutes from "./routes/photoRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";
import rewardRoutes from "./routes/rewardRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { seedCoupons } from "./utils/seedCoupons.js";

// ═══════════════ APP SETUP ═══════════════

const app = express();
const PORT = process.env.PORT || 5000;

// ── Global Middleware ──
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increased limit for base64 images
app.use(requestLogger);

// ── Serve Frontend Static Files ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, "..")));

// ── Health Check ──
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "HiddenTrails.AI Backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──
// All routes are mounted at root level to preserve existing frontend paths
app.use(itineraryRoutes);   // POST /generate-itinerary, POST /regenerate-itinerary
app.use(chatbotRoutes);     // POST /chat, POST /chatbot, POST /chat/clear
app.use(photoRoutes);       // POST /verify-photo, POST /photo/verify
app.use(imageRoutes);       // GET  /get-destination-image
app.use(rewardRoutes);      // GET  /rewards/:userId, POST /rewards/claim-trip
app.use(couponRoutes);      // GET  /coupons, POST /coupon/redeem
app.use(adminRoutes);       // CRUD /admin/places

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
    hint: "Check the API documentation for available endpoints",
  });
});

// ── Global Error Handler (must be last middleware) ──
app.use(errorHandler);

// ═══════════════ START SERVER ═══════════════

app.listen(PORT, () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🌿 HiddenTrails.AI Backend — RUNNING");
  console.log(`  🚀 Server:   http://localhost:${PORT}`);
  console.log(`  ❤️  Health:   http://localhost:${PORT}/health`);
  console.log("  ─────────────────────────────────────────────────────────");
  console.log("  📍 Endpoints:");
  console.log("     POST /generate-itinerary      — AI Itinerary");
  console.log("     POST /regenerate-itinerary     — Regenerate Trip");
  console.log("     POST /chat                     — AI Chatbot");
  console.log("     POST /chatbot                  — AI Chatbot (alias)");
  console.log("     POST /chat/clear               — Clear Chat History");
  console.log("     POST /verify-photo             — Photo Challenge");
  console.log("     POST /photo/verify             — Photo Challenge (alias)");
  console.log("     GET  /get-destination-image    — Destination Images");
  console.log("     GET  /rewards/:userId          — User Rewards");
  console.log("     POST /rewards/claim-trip       — Claim Trip Reward");
  console.log("     GET  /coupons                  — Available Coupons");
  console.log("     POST /coupon/redeem            — Redeem Coupon");
  console.log("     GET  /health                   — Health Check");
  console.log("     CRUD /admin/places              — Admin Tourist Places");
  console.log("═══════════════════════════════════════════════════════════");

  // Seed sample coupons on first run
  seedCoupons();
});

export default app;
