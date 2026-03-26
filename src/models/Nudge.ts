import mongoose, { Schema, Document } from "mongoose";

export const NUDGE_TYPES = ["friction_break", "daily_reminder"] as const;
export const NUDGE_TIERS = [
  "warmup",
  "core",
  "last_call",
  "early_spark",
  "evening_check",
] as const;

export type NudgeType = (typeof NUDGE_TYPES)[number];
export type NudgeTier = (typeof NUDGE_TIERS)[number];

export interface INudge extends Document {
  userId: mongoose.Types.ObjectId;
  dateKey: string;
  type: NudgeType;
  tier: NudgeTier;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  deliveredViaPush: boolean;
  dismissedAt: Date | null;
  createdAt: Date;
}

const NudgeSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  dateKey: { type: String, required: true },
  type: { type: String, enum: NUDGE_TYPES, required: true },
  tier: { type: String, enum: NUDGE_TIERS, required: true },
  message: { type: String, required: true },
  ctaLabel: { type: String, default: "Start Quick Timer" },
  ctaUrl: { type: String, default: "/dashboard" },
  deliveredViaPush: { type: Boolean, default: false },
  dismissedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

NudgeSchema.index({ userId: 1, dateKey: 1, tier: 1 }, { unique: true });

export default mongoose.models.Nudge ||
  mongoose.model<INudge>("Nudge", NudgeSchema);
