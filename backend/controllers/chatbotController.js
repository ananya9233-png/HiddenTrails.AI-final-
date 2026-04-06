import { chat, clearHistory } from "../services/chatbotService.js";

export async function handleChat(req, res) {
  try {
    const { message, sessionId } = req.body;

    console.log("🔥 CHAT HIT:", message);

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const session = sessionId || "default";

    // ✅ Only AI response (clean)
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

export async function handleClearChat(req, res) {
  try {
    const { sessionId } = req.body;
    clearHistory(sessionId || "default");

    res.json({
      success: true,
      message: "Conversation history cleared"
    });

  } catch (error) {
    console.error("❌ Clear chat error:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
}