// src/config/redis.ts
import { Redis } from "ioredis";

// 1. Look for the Cloud URL first (e.g., from Upstash in production)
const redisUrl = process.env.REDIS_URL;

// 2. Initialize Redis dynamically
const redis = redisUrl
  ? new Redis(redisUrl) // PRODUCTION: Uses the secure "rediss://" URL
  : new Redis({
      // LOCAL DEV: Falls back to your local setup
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    });

redis.on("connect", () => {
  // Helpful log so you know exactly which database you are talking to!
  console.log(`✅ Connected to Redis! (${redisUrl ? "Cloud" : "Local"})`);
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis connection error:", err.message);
});

export default redis;
