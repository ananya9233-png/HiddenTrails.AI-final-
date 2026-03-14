/**
 * Chatbot Controller
 * --------------------
 * Handles HTTP request/response for the AI travel chatbot.
 * Supports session-based conversation memory.
 */

import { chat, clearHistory } from "../services/chatbotService.js";

/**
 * POST /chat or POST /chatbot
 *
 * Processes a chat message and returns the AI response.
 * Uses sessionId from request body for conversation memory.
 * Falls back to a default session if not provided (backwards compatible).
 */
export async function handleChat(req, res) {
  try {
    const { message, sessionId } = req.body;

    console.log("🔥 CHAT HIT:", message);

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Use provided sessionId or fallback to "default" for backwards compatibility
    const session = sessionId || "default";

    const reply = await chat(session, message);

    if (!reply) {
      return res.status(500).json({ error: "No AI reply generated" });
    }

    res.json({ reply });
  } catch (error) {
    console.error("❌ Chatbot error:", error);
    res.status(500).json({ error: "Chatbot failed" });
  }
}

/**
 * POST /chat/clear
 *
 * Clears the conversation history for a session.
 */

export async function handleClearChat(req, res) {
  try {
    const { sessionId } = req.body;
    clearHistory(sessionId || "default");
    res.json({ success: true, message: "Conversation history cleared" });
  } catch (error) {
    console.error("❌ Clear chat error:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
}