import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEgg extends Document {
  name: string;
  emoji: string;
  color: string;
  uniqueCode: string;
  isClaimed: boolean;
  claimedBy?: Types.ObjectId; // Optional until someone finds it
}

const EggSchema: Schema = new Schema({
  name: { type: String, required: true },
  emoji: { type: String, required: true },
  color: { type: String, required: true },
  uniqueCode: {
    type: String,
    required: true,
    unique: true, // Ensures no two QR codes are identical
  },
  isClaimed: {
    type: Boolean,
    default: false,
  },
  claimedBy: {
    type: Schema.Types.ObjectId,
    ref: "Participant", // Links directly to the Participant who found it
    default: null,
  },
});

export const Egg = mongoose.model<IEgg>("Egg", EggSchema);
