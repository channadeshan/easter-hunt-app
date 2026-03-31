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
import activityRoute from "./routes/activityRoute.js";
import cors from "cors";
const app = express();

// Middleware
const corsOptions: cors.CorsOptions = {
  origin: "https://easter-hunt-app-frontend.vercel.app", // Allow only your frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true, // Allow cookies if needed
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Database Connection
connectDB();

// Routes
app.use("/api", activityRoute);
app.use("/api/auth", authStatusRoute);
app.use("/api/admin", adminRoutes);
app.use("/api/parti", participantRoutes);

// Create HTTP Server
const httpServer = createServer(app);

// Initialize Socket.io
export const io = new Server(httpServer, {
  cors: {
    origin: "http://https://easter-hunt-app-frontend.vercel.app", // exact frontend URL, no trailing slash
    credentials: true, // required — allows cookies through
    methods: ["GET", "POST"],
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
