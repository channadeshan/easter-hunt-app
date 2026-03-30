import mongoose, { Schema, Document, Types } from "mongoose";

// 1. Define the TypeScript Interface
// This ensures that when you type `Activity.create()`, your code editor
// will strictly enforce these exact fields.
export interface IActivity extends Document {
  type: "EGG_CLAIMED" | "HINT_DISCOVERED";
  participantId: Types.ObjectId;
  itemName: string;
  createdAt: Date;
}

// 2. Define the Mongoose Schema
const ActivitySchema: Schema = new Schema({
  type: {
    type: String,
    // The 'enum' acts as a strict bouncer. If you accidentally try to save
    // type: 'USER_LOGGED_IN', Mongoose will reject it and throw an error.
    enum: ["EGG_CLAIMED", "HINT_DISCOVERED"],
    required: true,
  },
  participantId: {
    type: Schema.Types.ObjectId,
    ref: "Participant", // This links directly to your Participant model
    required: true,
  },
  itemName: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 3. Export the Model
export const Activity = mongoose.model<IActivity>("Activity", ActivitySchema);
