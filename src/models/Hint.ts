import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHint extends Document {
  text: string;
  eggId: Types.ObjectId;
  uniqueCode: string;
  isDiscovered: boolean;
  discoveredBy?: Types.ObjectId;
}

const HintSchema: Schema = new Schema({
  text: { type: String, required: true },
  eggId: {
    type: Schema.Types.ObjectId,
    ref: "Egg", // Links this hint to its specific parent Egg
    required: true,
  },
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
  },
  isDiscovered: {
    type: Boolean,
    default: false,
  },
  discoveredBy: {
    type: Schema.Types.ObjectId,
    ref: "Participant", // Tracks exactly who found the hint first
    default: null,
  },
});

export const Hint = mongoose.model<IHint>("Hint", HintSchema);
