/**
 * Groq API Configuration
 * -----------------------
 * Centralizes all Groq API settings: base URL, API key, and model identifiers.
 * All AI service modules import from here instead of hardcoding values.
 */

import dotenv from "dotenv";
dotenv.config();

// Groq API base URL for OpenAI-compatible completions endpoint
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

// API key loaded from environment variable

export const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("❌ FATAL: GROQ_API_KEY not found in .env file");
  process.exit(1);
}

// Model identifiers — update these when upgrading to newer models
export const LLAMA_TEXT_MODEL = "llama-3.1-8b-instant"; // Fast text generation
export const LLAMA_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // Multimodal vision

/**
 * Helper to build the Authorization header for Groq API calls.
 * @returns {{ Authorization: string, "Content-Type": string }}
 */
export function getGroqHeaders() {
  return {
    Authorization: `Bearer ${GROQ_API_KEY}`,
    "Content-Type": "application/json",
  };
}