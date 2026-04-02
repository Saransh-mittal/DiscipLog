import mongoose, { Document, Schema } from "mongoose";
import {
  SMART_RECALL_RARITIES,
  SMART_RECALL_STATUSES,
  type SmartRecallRarity,
  type SmartRecallStatus,
} from "@/lib/smart-recall-types";

export interface ISmartRecallCard extends Document {
  userId: mongoose.Types.ObjectId;
  sourceLogId: mongoose.Types.ObjectId;
  title: string;
  prompt: string;
  answer: string;
  why: string;
  category: string;
  sourceDate: string;
  rarity: SmartRecallRarity;
  status: SmartRecallStatus;
  dueAt: Date;
  completedAt: Date | null;
  lastViewedAt: Date | null;
  snoozeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SmartRecallCardSchema = new Schema<ISmartRecallCard>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceLogId: { type: Schema.Types.ObjectId, ref: "LogEntry", required: true },
    title: { type: String, required: true, trim: true },
    prompt: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    why: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    sourceDate: { type: String, required: true, trim: true },
    rarity: { type: String, enum: SMART_RECALL_RARITIES, required: true },
    status: {
      type: String,
      enum: SMART_RECALL_STATUSES,
      default: "due",
      required: true,
    },
    dueAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    lastViewedAt: { type: Date, default: null },
    snoozeCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

SmartRecallCardSchema.index({ userId: 1, sourceLogId: 1 }, { unique: true });
SmartRecallCardSchema.index({ userId: 1, status: 1, dueAt: 1 });
SmartRecallCardSchema.index({ userId: 1, completedAt: -1 });

export default mongoose.models.SmartRecallCard ||
  mongoose.model<ISmartRecallCard>("SmartRecallCard", SmartRecallCardSchema);
