import Router, { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid"; // To generate a secure, random session ID
import { Participant } from "../models/Participant.js"; // Your updated Mongoose model
import redis from "../config/redis.js";
import { requireParticipant, type ParticipantRequest } from "../middlewares.js";

const app = Router(); // Connects to your local Redis instance

app.post(
  "/join",
  async (req: ParticipantRequest, res: Response): Promise<void> => {
    try {
      const { username, emojiUrl } = req.body;

      if (!username || !emojiUrl) {
        res.status(400).json({ error: "Username and emoji are required." });
        return;
      }

      // 1. Check MongoDB: Does this user exist, or are they new?
      let participant = await Participant.findOne({ username });

      if (!participant) {
        // New player! Create them in MongoDB
        participant = await Participant.create({ username, emojiUrl });
      } else {
        // Optional: Update their emoji if they picked a new one upon returning
        //   participant.emojiUrl = emojiUrl;
        //   await participant.save();
      }

      // 2. Generate a secure, unique Session ID
      const sessionId = uuidv4();

      // 3. Save to Redis with a 24-hour expiration (86,400 seconds)
      // 'EX' tells Redis to expire the key in seconds
      await redis.set(`session:${sessionId}`, participant.id, "EX", 86400);

      // 4. Send the Session ID to the phone in a 24-hour HttpOnly cookie
      res.cookie("participant_session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      });

      res.status(200).json({
        message: "Successfully joined the hunt!",
        participant: {
          id: participant.id,
          username: participant.username,
          emojiUrl: participant.emojiUrl,
        },
      });
    } catch (error) {
      console.error("Join error:", error);
      res.status(500).json({ error: "Failed to join the game" });
    }
  },
);

app.get(
  "/test",
  requireParticipant,
  async (req: Request, res: Response): Promise<void> => {
    // If we made it here, the requireParticipant middleware passed and req.participantId is set
    res.status(200).json({
      message: "Test route accessed successfully!",
      participantId: (req as ParticipantRequest).participantId,
    });
  },
);

export default app;
