import Router, { type Request, type Response } from "express";
import { Activity } from "../models/Activity.js";
import { requireAnyAuth, type UniversalAuthRequest } from "../middlewares.js";
// import { requireParticipant, ParticipantRequest } from './participantMiddleware';
// import { Activity } from './models';
const router = Router();

router.get(
  "/activities",
  requireAnyAuth,
  async (req: UniversalAuthRequest, res: Response): Promise<void> => {
    try {
      // 1. Fetch the 50 most recent events
      // 2. Sort by 'createdAt: -1' pushes the newest events to the very top
      // 3. Populate pulls the username and emojiUrl from the linked Participant document
      const recentActivities = await Activity.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("participantId", "username emojiUrl");

      console.log(recentActivities);
      // Send the array directly back to the frontend
      res.status(200).json(recentActivities);
    } catch (error) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ error: "Failed to load recent activities." });
    }
  },
);

export default router;
