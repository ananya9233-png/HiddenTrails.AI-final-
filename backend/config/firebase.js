/**
 * Firebase Admin SDK Configuration
 * ----------------------------------
 * Initializes Firebase Admin with service account credentials.
 * Exports the Firestore database instance for use across all services.
 *
 * SETUP: Download your serviceAccountKey.json from Firebase Console
 *        → Project Settings → Service Accounts → Generate New Private Key
 *        → Place the file in /backend/config/serviceAccountKey.json
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, "serviceAccountKey.json");

// Validate that the service account key exists before initializing
if (!existsSync(serviceAccountPath)) {
  console.error(
    "❌ FATAL: serviceAccountKey.json not found in /backend/config/"
  );
  console.error(
    "   Download it from Firebase Console → Project Settings → Service Accounts"
  );
  process.exit(1);
}

// Parse the service account key and initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/** @type {admin.firestore.Firestore} */
const db = admin.firestore();

console.log("✅ Firebase Admin initialized successfully");

export { db, admin };