import express from "express";
import "dotenv/config";
import { Server } from "socket.io";
import { createServer } from "http";
import adminRoutes from "./routes/adminRoutes.js";
import participantRoutes from "./routes/participantRoutes.js";
import authStatusRoute from "./routes/authStatus.js";
import cookieParser from "cookie-parser";
import "./config/redis.js";
import connectDB from "./config/db.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
connectDB();
app.use("/api/auth", authStatusRoute); // Add this line to include the auth status route
app.use("/api/admin", adminRoutes);
app.use("/api/parti", participantRoutes); // Add this line to include participant routes

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || "0000";

// Only for Development Environment: Uncomment this to generate a hash for your admin password, then delete this function and its call.
// import { generateHash } from "./helper.js";
// generateHash();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
