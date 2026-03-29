// src/config/redis.ts
import { Redis } from "ioredis";

// Connect to the local Redis instance
// ioredis defaults to 127.0.0.1:6379 if no URL is provided
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
});

redis.on("connect", () => {
  console.log("✅ Connected to local Redis!");
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis connection error:", err.message);
});

export default redis;
