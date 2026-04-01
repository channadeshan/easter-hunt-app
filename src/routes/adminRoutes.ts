import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAdmin } from "../middlewares.js";
import { Egg } from "../models/Egg.js";
import { Hint } from "../models/Hint.js";
import crypto from "crypto";
import mongoose from "mongoose";
import redis from "../config/redis.js";
import { Participant } from "../models/Participant.js";
import { Activity } from "../models/Activity.js";
import { io } from "../index.js"; // Import the Socket.IO instance to emit events

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    // 1. Check if password was provided
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }

    // 2. Fetch the hash from your environment variables
    const adminHash = process.env.ADMIN_HASH;
    const sessionSecret = process.env.SESSION_SECRET;

    if (!adminHash || !sessionSecret) {
      console.error("Server misconfiguration: Missing environment variables.");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // 3. Compare the typed password with the stored hash
    const isMatch = await bcrypt.compare(password, adminHash);

    if (!isMatch) {
      // Candid security tip: Always use generic error messages for failed logins
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // 4. Password is correct! Create a session token.
    // We embed { role: 'organizer' } so the server knows who this is later.
    const token = jwt.sign({ role: "organizer" }, sessionSecret, {
      expiresIn: "12h", // The token will expire after 12 hours
    });

    // 5. Send the token in a secure HttpOnly cookie
    res.cookie("admin_session", token, {
      httpOnly: true, // JavaScript cannot access this cookie (prevents XSS attacks)
      secure: true, // Use true if hosting on HTTPS
      sameSite: "none", // Protects against CSRF attacks
      maxAge: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
    });

    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/test", requireAdmin, (req: Request, res: Response) => {
  res.json({ message: "You have access to this protected route!" });
});

router.post(
  "/egg",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, emoji, color } = req.body;

      // 1. Generate the secure string
      const randomHex = crypto.randomBytes(4).toString("hex");
      const uniqueCode = `egg_${randomHex}`;

      // 2. Save it to MongoDB
      const newEgg = await Egg.create({ name, emoji, color, uniqueCode });

      // 3. Just send the raw text code back!
      res.status(201).json({
        message: "Egg created successfully!",
        egg: newEgg,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create Egg" });
    }
  },
);

router.post(
  "/hint",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, eggId } = req.body;

      // 1. Validate the incoming data
      if (!text || !eggId) {
        res
          .status(400)
          .json({ error: "Hint text and a parent Egg ID are required." });
        return;
      }

      // 2. Verify the parent Egg actually exists in the database
      // We don't want to attach a hint to an Egg that was deleted or doesn't exist!
      const parentEgg = await Egg.findById(eggId);

      if (!parentEgg) {
        res
          .status(404)
          .json({ error: "Parent Egg not found. Cannot create hint." });
        return;
      }

      // 3. Generate the secure, random string (e.g., "hint_8f2a1b9c")
      const randomHex = crypto.randomBytes(4).toString("hex");
      const uniqueCode = `hint_${randomHex}`;

      // 4. Save the new Hint to MongoDB
      const newHint = await Hint.create({
        text: text,
        eggId: parentEgg.id,
        uniqueCode: uniqueCode,
        // isDiscovered automatically defaults to false based on our schema
      });

      // 5. Send the raw text code back to the frontend so it can render the QR code
      res.status(201).json({
        message: "Hint created successfully!",
        hint: newHint,
      });
    } catch (error) {
      console.error("Hint creation error:", error);
      res.status(500).json({ error: "Failed to create Hint." });
    }
  },
);

router.get(
  "/eggs",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Fetch all eggs from newest to oldest
      // We use .populate() so if an egg is claimed, we instantly get the
      // username and emoji of the student who found it!
      const eggs = await Egg.find()
        .sort({ _id: -1 })
        .populate("claimedBy", "username emojiUrl");

      res.status(200).json({ eggs });
    } catch (error) {
      console.error("Error fetching eggs:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch eggs from the database." });
    }
  },
);

router.get(
  "/hints",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Fetch all hints.
      // We populate the parent Egg so the Organizer knows which egg this hint belongs to.
      // We also populate the Participant who discovered it.
      const hints = await Hint.find()
        .sort({ _id: -1 })
        .populate("eggId", "name emoji color")
        .populate("discoveredBy", "username emojiUrl");

      res.status(200).json({ hints });
    } catch (error) {
      console.error("Error fetching hints:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch hints from the database." });
    }
  },
);

router.delete(
  "/hints/:hintId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { hintId } = req.params;

      // Find the hint by its ID and delete it
      const deletedHint = await Hint.findByIdAndDelete(hintId);

      if (!deletedHint) {
        res
          .status(404)
          .json({ error: "Hint not found. It may have already been deleted." });
        return;
      }

      res.status(200).json({ message: "Hint deleted successfully." });
    } catch (error) {
      console.error("Error deleting hint:", error);
      res.status(500).json({ error: "Failed to delete the hint." });
    }
  },
);

router.delete(
  "/eggs/:eggId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { eggId } = req.params;

      // 1. The Safety Check (Satisfies TypeScript)
      // Ensure eggId actually exists and is exactly a string.
      if (!eggId || typeof eggId !== "string") {
        res.status(400).json({ error: "Invalid Egg ID provided." });
        return;
      }

      // 2. Delete the parent Egg first
      const deletedEgg = await Egg.findByIdAndDelete(eggId);

      if (!deletedEgg) {
        res
          .status(404)
          .json({ error: "Egg not found. It may have already been deleted." });
        return;
      }

      // 3. The Cast (Satisfies Mongoose)
      // Convert the string into a strict Mongoose ObjectId
      const mongooseEggId = new mongoose.Types.ObjectId(eggId);

      // 4. The Cascading Delete
      // Now TypeScript knows for a fact that mongooseEggId is valid!
      const deleteResult = await Hint.deleteMany({ eggId: mongooseEggId });

      res.status(200).json({
        message: "Egg and all related hints were successfully deleted.",
        deletedHintsCount: deleteResult.deletedCount,
      });
    } catch (error) {
      console.error("Error deleting egg:", error);
      res
        .status(500)
        .json({ error: "Failed to delete the egg and its hints." });
    }
  },
);

router.post("/logout", (req: Request, res: Response): void => {
  // 1. Tell the browser to instantly expire and delete the cookie
  res.clearCookie("admin_session", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  // 2. Send a success message
  res.status(200).json({ message: "Successfully logged out." });
});

router.post(
  "/reset-game",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Reset all Eggs (Un-claim them and remove the player ID)
      // Mongoose $set ensures we explicitly overwrite these specific fields
      await Egg.updateMany(
        {},
        {
          $set: { isClaimed: false, claimedBy: null },
        },
      );

      // 2. Reset all Hints
      await Hint.updateMany(
        {},
        {
          $set: { isDiscovered: false, discoveredBy: null },
        },
      );

      // 3. Wipe the Ledgers and Players
      // Delete all history and test accounts from MongoDB
      await Activity.deleteMany({});
      await Participant.deleteMany({});

      // 4. Wipe the Redis Memory (Log everyone out)
      // Find all keys starting with 'session:' and delete them
      const sessionKeys = await redis.keys("session:*");
      if (sessionKeys.length > 0) {
        await redis.del(sessionKeys);
      }

      // 5. The Loudspeaker: Tell all connected phones the game is over/reset!
      io.emit("game_reset", {
        message:
          "The game has been reset by the Organizer. Please log in again.",
      });

      res.status(200).json({
        message:
          "Game successfully reset! All eggs and hints are hidden, and the database is clean.",
      });
    } catch (error) {
      console.error("Error resetting game:", error);
      res.status(500).json({ error: "Failed to cleanly reset the game." });
    }
  },
);

export default router;
