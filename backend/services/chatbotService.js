/**
 * Chatbot Service
 * -----------------
 * AI-powered travel chatbot using Groq LLaMA 3.1.
 * Maintains conversation history per session for context-aware responses.
 * Focuses on eco-friendly travel suggestions.
 */

import fetch from "node-fetch";
import {
  GROQ_BASE_URL,
  getGroqHeaders,
  LLAMA_TEXT_MODEL,
} from "../config/groq.js";
import { CHATBOT } from "../config/constants.js";

// ==================== CONVERSATION MEMORY ====================
// In-memory conversation store: Map<sessionId, messages[]>
// In production, this could be moved to Redis or Firestore for persistence
const conversationStore = new Map();

// System prompt that defines the chatbot's personality and focus
const SYSTEM_PROMPT = {
  role: "system",
  content: `You are HiddenTrails AI, a friendly and knowledgeable eco-travel assistant. Your personality:
- You're enthusiastic about hidden gems and off-the-beaten-path destinations
- You actively promote eco-friendly and sustainable travel practices
- You give concise, practical advice (max 4-5 sentences per response)
- You know about Indian destinations in depth: local cuisine, budget tips, best seasons, cultural etiquette
- You suggest eco-friendly alternatives when possible (trains over flights, local stays over chains, etc.)
- When asked about a destination, include a practical tip and a hidden gem recommendation
- You speak in a casual, Gen-Z friendly tone without being cringe`,
};

/**
 * Process a chat message with conversation history for context-aware responses.
 *
 * @param {string} sessionId - Unique session identifier (e.g., from cookies or auth token)
 * @param {string} message   - User's message
 * @returns {Promise<string>} AI's reply text
 */
export async function chat(sessionId, message) {
  if (!message || message.trim().length === 0) {
    throw new Error("Message is required");
  }

  // Get or initialize conversation history for this session
  let history = conversationStore.get(sessionId) || [];

  // Append the user's new message
  history.push({ role: "user", content: message });

  // Trim history to prevent token overflow (keep system + last N messages)
  if (history.length > CHATBOT.MAX_HISTORY_LENGTH) {
    history = history.slice(-CHATBOT.MAX_HISTORY_LENGTH);
  }

  // Build full message array: system prompt + conversation history
  const messages = [SYSTEM_PROMPT, ...history];

  const response = await fetch(GROQ_BASE_URL, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify({
      model: LLAMA_TEXT_MODEL,
      messages,
      max_tokens: CHATBOT.MAX_TOKENS,
      temperature: CHATBOT.TEMPERATURE,
    }),
  });

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("No response received from AI model");
  }

  // Append AI's reply to history for future context
  history.push({ role: "assistant", content: reply });

  // Update the conversation store
  conversationStore.set(sessionId, history);

  return reply;
}

/**
 * Clear the conversation history for a specific session.
 * Useful when user starts a new conversation or logs out.
 *
 * @param {string} sessionId
 */
export function clearHistory(sessionId) {
  conversationStore.delete(sessionId);
}

/**
 * Get conversation history length for monitoring/debugging.
 *
 * @param {string} sessionId
 * @returns {number}
 */
export function getHistoryLength(sessionId) {
  return conversationStore.get(sessionId)?.length || 0;
}
