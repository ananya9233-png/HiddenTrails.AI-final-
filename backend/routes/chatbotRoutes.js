/**
 * Chatbot Routes
 * ----------------
 * POST /chat     — Send a message (backwards compatible with existing frontend)
 * POST /chatbot  — Send a message (new RESTful alias)
 * POST /chat/clear — Clear conversation history
 */
import { Router } from "express";
import { handleChat, handleClearChat } from "../controllers/chatbotController.js";

const router = Router();

router.post("/chat", handleChat);
router.post("/chatbot", handleChat);
router.post("/chat/clear", handleClearChat);

export default router;
