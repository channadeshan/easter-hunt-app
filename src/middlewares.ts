import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import redis from "./config/redis.js";

// Optional but recommended: Extend the Express Request type
// so we can attach the decoded token data to it.
export interface AuthRequest extends Request {
  organizer?: any;
}

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // 1. Look for the cookie we set during login
    const token = req.cookies.admin_session;

    // 2. If the cookie is missing, they are not logged in
    if (!token) {
      res.status(401).json({ error: "Unauthorized: Please log in first." });
      return;
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.error("Missing SESSION_SECRET in .env");
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // 3. Verify the token is valid and hasn't expired
    const decoded = jwt.verify(token, secret) as any;

    // 4. Extra check: Ensure the token belongs to the Organizer role
    if (decoded.role !== "organizer") {
      res
        .status(403)
        .json({ error: "Forbidden: You do not have admin access." });
      return;
    }

    // 5. Success! Attach the data to the request and let them pass
    req.organizer = decoded;
    next(); // This is the crucial part—it tells Express to move to the actual route
  } catch (error) {
    // If jwt.verify() fails (e.g., someone tampered with the token or it expired)
    // console.log(error);
    res
      .status(401)
      .json({ error: "Unauthorized: Invalid or expired session." });
    return;
  }
};

export interface ParticipantRequest extends Request {
  participantId?: string;
}

export const requireParticipant = async (
  req: ParticipantRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 3. Grab the session ID from the cookie we set during login
    const sessionId = req.cookies.participant_session;

    // If there is no cookie, they are either not logged in or they cleared their browser data
    if (!sessionId) {
      res
        .status(401)
        .json({ error: "Unauthorized: Please join the game first." });
      return;
    }

    // 4. The Lightning-Fast Redis Check
    // We ask Redis: "Do you have a user ID stored under this session key?"
    const participantId = await redis.get(`session:${sessionId}`);

    // If Redis returns null, the session has expired (the 24h TTL ran out) or is invalid
    if (!participantId) {
      res
        .status(401)
        .json({ error: "Session expired: Please rejoin the game." });
      return;
    }

    // 5. Success! Attach the Mongoose _id to the request and pass the baton
    req.participantId = participantId;
    next(); // This tells Express to move on to your actual route logic
  } catch (error) {
    console.error("Redis session error:", error);
    res
      .status(500)
      .json({ error: "Internal server error while verifying session." });
  }
};
