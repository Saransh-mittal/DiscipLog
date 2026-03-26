import mongoose, { Schema, Document } from "mongoose";
import {
  AI_PERSONAS,
  DEFAULT_AI_PERSONA,
  type StoredAIProfile,
} from "@/lib/ai-profile";

export interface IUserCategory {
  name: string;
  dailyTargetHours: number;
  weeklyMinTarget: number;
  weeklyMaxTarget: number;
  icon: string;
  isSideCategory?: boolean;
  isActive?: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  categories: IUserCategory[];
  aiProfile: StoredAIProfile;
  usagePattern: {
    avgLogHour: number | null;
    dayOfWeekAvgHour: (number | null)[];
    sampleSize: number;
    lastCalculatedAt: Date | null;
    inferredTimezone: string;
  };
  onboardingCompleted: boolean;
  createdAt: Date;
}

const UserCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    dailyTargetHours: { type: Number, required: true, min: 0 },
    weeklyMinTarget: { type: Number, required: true, min: 0 },
    weeklyMaxTarget: { type: Number, required: true, min: 0 },
    icon: { type: String, required: true },
    isSideCategory: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const AIProfileSchema = new Schema(
  {
    persona: {
      type: String,
      enum: AI_PERSONAS,
      default: DEFAULT_AI_PERSONA,
    },
    coreWhy: { type: String, trim: true, default: "" },
    customInstructions: { type: String, trim: true, default: "" },
    implicitMemory: { type: String, default: "" },
    implicitMemoryUpdatedAt: { type: Date, default: null },
    implicitMemoryLastEvaluatedLogAt: { type: Date, default: null },
    implicitMemoryLastEvaluatedChatAt: { type: Date, default: null },
    implicitMemoryPending: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  image: { type: String },
  categories: {
    type: [UserCategorySchema],
    default: [],
    validate: {
      validator: (arr: IUserCategory[]) => arr.length <= 7,
      message: "Maximum 7 categories allowed",
    },
  },
  aiProfile: {
    type: AIProfileSchema,
    default: () => ({}),
  },
  usagePattern: {
    type: new Schema(
      {
        avgLogHour: { type: Number, default: null },
        dayOfWeekAvgHour: { type: [Schema.Types.Mixed], default: () => Array(7).fill(null) },
        sampleSize: { type: Number, default: 0 },
        lastCalculatedAt: { type: Date, default: null },
        inferredTimezone: { type: String, default: "Asia/Kolkata" },
      },
      { _id: false }
    ),
    default: () => ({}),
  },
  onboardingCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
