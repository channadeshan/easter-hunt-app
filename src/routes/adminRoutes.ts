import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAdmin } from "../middlewares.js";

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
      secure: process.env.IS_PRODUCTION === "true", // Use true if hosting on HTTPS
      sameSite: "strict", // Protects against CSRF attacks
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

export default router;
