import Router, { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import redis from "../config/redis.js";
import { Participant } from "../models/Participant.js"; // Your Mongoose model

const app = Router();

app.get("/status", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Check for an Organizer Cookie first
    const adminCookie = req.cookies.admin_session;

    if (adminCookie) {
      try {
        // Verify the JWT
        const secret = process.env.SESSION_SECRET as string;
        const decoded = jwt.verify(adminCookie, secret) as any;

        if (decoded.role === "organizer") {
          // It's the Admin! Send them to the Organizer panel.
          res.status(200).json({
            isAuthenticated: true,
            role: "organizer",
          });
          return;
        }
      } catch (err) {
        // Token expired or invalid, just silently fall through
        console.log("Admin token invalid, checking for participant...");
      }
    }

    // 2. Check for a Participant Cookie
    const participantCookie = req.cookies.participant_session;

    if (participantCookie) {
      // Check Redis for the session
      const participantId = await redis.get(`session:${participantCookie}`);

      if (participantId) {
        // Fetch the player's profile from MongoDB
        const participant = await Participant.findById(participantId);

        if (participant) {
          // It's a Player! Send them to the Game Dashboard.
          res.status(200).json({
            isAuthenticated: true,
            role: "participant",
            user: {
              id: participant.id,
              username: participant.username,
              emojiUrl: participant.emojiUrl,
            },
          });
          return;
        }
      }
    }

    // 3. If neither cookie exists or both are invalid/expired
    // We return a 200 OK, but tell the frontend they are NOT authenticated.
    // This is cleaner than returning a 401 error on app boot.
    res.status(200).json({
      isAuthenticated: false,
      role: null,
    });
  } catch (error) {
    console.error("Auth status error:", error);
    res.status(500).json({ error: "Internal server error during auth check" });
  }
});

export default app;
