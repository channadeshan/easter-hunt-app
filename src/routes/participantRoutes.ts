import Router, { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid"; // To generate a secure, random session ID
import { Participant } from "../models/Participant.js"; // Your updated Mongoose model
import redis from "../config/redis.js";
import { requireParticipant, type ParticipantRequest } from "../middlewares.js";
import { Activity } from "../models/Activity.js";
import { Egg } from "../models/Egg.js";
import { Hint } from "../models/Hint.js";
import mongoose from "mongoose";
import { io } from "../index.js"; // Import the Socket.IO instance to emit events

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

app.post(
  "/scan",
  requireParticipant,
  async (req: ParticipantRequest, res: Response): Promise<void> => {
    try {
      const { scannedCode } = req.body;
      const playerId = req.participantId;

      if (!playerId || typeof playerId !== "string") {
        res.status(401).json({ error: "Unauthorized: Missing player ID." });
        return;
      }

      if (!scannedCode || typeof scannedCode !== "string") {
        res.status(400).json({ error: "No valid QR code provided." });
        return;
      }

      // 2. THE NEW FIX: Convert the safe string into a strict Mongoose ObjectId!
      const mongoosePlayerId = new mongoose.Types.ObjectId(playerId);

      // 1. Safety Check: Ensure the player still exists in the database
      const player = await Participant.findById(mongoosePlayerId);
      if (!player) {
        res
          .status(401)
          .json({ error: "Player profile not found. Please log in again." });
        return;
      }

      // ==========================================
      // SCENARIO 1: THEY SCANNED AN EGG
      // ==========================================
      if (scannedCode.startsWith("egg_")) {
        // Atomic Update: Prevents race conditions
        const claimedEgg = await Egg.findOneAndUpdate(
          { uniqueCode: scannedCode, isClaimed: false },
          { isClaimed: true, claimedBy: playerId },
          { new: true },
        );

        if (!claimedEgg) {
          const exists = await Egg.findOne({ uniqueCode: scannedCode });
          if (exists) {
            // UX Enhancement: Check if *they* already claimed it
            if (exists.claimedBy?.toString() === playerId?.toString()) {
              res
                .status(400)
                .json({ error: "You have already claimed this egg!" });
            } else {
              res.status(400).json({
                error: "Too late! Someone else already claimed this egg.",
              });
            }
          } else {
            res.status(404).json({ error: "Invalid Egg QR Code." });
          }
          return;
        }

        // Save to the Activity Ledger
        await Activity.create({
          type: "EGG_CLAIMED",
          participantId: mongoosePlayerId,
          itemName: claimedEgg.name,
        });

        // Broadcast the triumph to the campus
        io.emit("new_activity", {
          type: "EGG_CLAIMED",
          message: `${player.username} just claimed ${claimedEgg.name}!`,
          emoji: player.emojiUrl,
          timestamp: new Date(),
        });

        res.status(200).json({
          message: `You successfully claimed ${claimedEgg.name}!`,
          type: "egg",
          item: claimedEgg,
        });
        return;
      }

      // ==========================================
      // SCENARIO 2: THEY SCANNED A HINT
      // ==========================================
      else if (scannedCode.startsWith("hint_")) {
        const discoveredHint = await Hint.findOneAndUpdate(
          { uniqueCode: scannedCode, isDiscovered: false },
          { isDiscovered: true, discoveredBy: playerId },
          { new: true },
        ).populate("eggId", "name color emoji");

        if (!discoveredHint) {
          const exists = await Hint.findOne({ uniqueCode: scannedCode });
          if (exists) {
            // UX Enhancement: Check if *they* already discovered it
            if (exists.discoveredBy?.toString() === playerId?.toString()) {
              res
                .status(400)
                .json({ error: "You already discovered this hint!" });
            } else {
              res.status(400).json({
                error: "This hint was already discovered by someone else!",
              });
            }
          } else {
            res.status(404).json({ error: "Invalid Hint QR Code." });
          }
          return;
        }

        // Save to Activity Ledger (TypeScript error fixed cleanly)
        await Activity.create({
          type: "HINT_DISCOVERED",
          participantId: mongoosePlayerId,
          itemName: `Hint for ${(discoveredHint.eggId as any).name}`,
        });

        // Broadcast the hint to everyone so they can use it
        io.emit("new_activity", {
          type: "HINT_DISCOVERED",
          message: `${player.username} discovered a new hint!`,
          hintText: discoveredHint.text,
          emoji: player.emojiUrl,
          timestamp: new Date(),
        });

        res.status(200).json({
          message:
            "You discovered a new hint! It has been shared with everyone.",
          type: "hint",
          item: discoveredHint,
        });
        return;
      }

      // ==========================================
      // SCENARIO 3: INVALID QR CODE
      // ==========================================
      else {
        res.status(400).json({
          error: "Invalid QR Code. Did you scan a cafeteria menu by mistake?",
        });
        return;
      }
    } catch (error) {
      console.error("Scanning error:", error);
      res
        .status(500)
        .json({ error: "Internal server error while processing scan." });
    }
  },
);

app.get(
  "/eggs/available",
  requireParticipant,
  async (req: ParticipantRequest, res: Response): Promise<void> => {
    try {
      // Find all eggs where isClaimed is exactly false
      // SECURITY: We use .select() to ONLY return the safe fields.
      // If we didn't do this, players could steal the uniqueCode and cheat!
      const availableEggs = await Egg.find({ isClaimed: false }).select(
        "name emoji color _id",
      );

      res.status(200).json({
        count: availableEggs.length, // Helpful for the frontend to show "5 Eggs Remaining!"
        eggs: availableEggs,
      });
    } catch (error) {
      console.error("Error fetching available eggs:", error);
      res.status(500).json({ error: "Failed to fetch the available eggs." });
    }
  },
);

app.get(
  "/hints/discovered",
  requireParticipant,
  async (req: ParticipantRequest, res: Response): Promise<void> => {
    try {
      // Find all hints where isDiscovered is exactly true
      const discoveredHints = await Hint.find({ isDiscovered: true })
        .select("text eggId discoveredBy _id") // Keep the secret code out of here too
        .populate("eggId", "name emoji color") // Attach the parent egg details!
        .populate("discoveredBy", "username") // So you can show "Discovered by Alex"
        .sort({ _id: -1 }); // Sort by newest first

      res.status(200).json({
        count: discoveredHints.length,
        hints: discoveredHints,
      });
    } catch (error) {
      console.error("Error fetching discovered hints:", error);
      res.status(500).json({ error: "Failed to fetch the discovered hints." });
    }
  },
);

export default app;
