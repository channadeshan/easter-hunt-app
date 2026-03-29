import mongoose, { Schema, Document } from "mongoose";

// 1. Define the TypeScript Interface
export interface IParticipant extends Document {
  username: string;
  emojiUrl: string;
  sessionId: string;
  createdAt: Date;
}

// 2. Define the Mongoose Schema
const ParticipantSchema: Schema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true, // Enforces the unique username rule
    trim: true,
  },
  emojiUrl: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 3. Export the Model
export const Participant = mongoose.model<IParticipant>(
  "Participant",
  ParticipantSchema,
);
