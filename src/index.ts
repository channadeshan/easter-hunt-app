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
import { Participant } from "./models/Participant.js";
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// Database Connection
connectDB();

// Routes
app.use("/api/auth", authStatusRoute);
app.use("/api/admin", adminRoutes);
app.use("/api/parti", participantRoutes);

// Create HTTP Server
const httpServer = createServer(app);

// Initialize Socket.io
export const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Socket Logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user connects, we tell everyone the new total count
  io.emit("live_player_count", io.engine.clientsCount);

  socket.on("disconnect", () => {
    // When a user leaves, update the count for everyone
    io.emit("live_player_count", io.engine.clientsCount);
  });
});

// START THE SERVER HERE (Outside the socket block)
const PORT = process.env.PORT || 3000; // Use a real port like 3000

httpServer.listen(PORT, () => {
  console.log(`🚀 Server and WebSockets running on port ${PORT}`);
});
