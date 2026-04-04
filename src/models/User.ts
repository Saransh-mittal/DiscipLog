import mongoose, { Schema, Document } from "mongoose";
import {
  AI_PERSONAS,
  DEFAULT_AI_PERSONA,
  type StoredAIProfile,
} from "@/lib/ai-profile";

export interface ICategoryNote {
  _id?: string;
  text: string;
  done: boolean;
  createdAt: Date;
}

export interface IUserCategory {
  _id?: string;
  name: string;
  dailyTargetHours: number;
  weeklyMinTarget: number;
  weeklyMaxTarget: number;
  icon: string;
  isSideCategory?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
  notes?: ICategoryNote[];
}

export type SubscriptionPlan = "free" | "pro";
export type ProModelChoice = "gpt-5-mini" | "gpt-5";

export interface IUserSubscription {
  plan: SubscriptionPlan;
  preferredModel: ProModelChoice;
  upgradedAt?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  categories: IUserCategory[];
  aiProfile: StoredAIProfile;
  subscription: IUserSubscription;
  smartRecall?: {
    tutorialSeenAt: Date | null;
  };
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

const CategoryNoteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const UserCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    dailyTargetHours: { type: Number, required: true, min: 0 },
    weeklyMinTarget: { type: Number, required: true, min: 0 },
    weeklyMaxTarget: { type: Number, required: true, min: 0 },
    icon: { type: String, required: true },
    isSideCategory: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    notes: { type: [CategoryNoteSchema], default: [] },
  },
  { _id: true }
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

const SubscriptionSchema = new Schema(
  {
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    preferredModel: { type: String, enum: ["gpt-5-mini", "gpt-5"], default: "gpt-5-mini" },
    upgradedAt: { type: Date, default: null },
  },
  { _id: false }
);

const SmartRecallSchema = new Schema(
  {
    tutorialSeenAt: { type: Date, default: null },
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
      validator: (arr: IUserCategory[]) =>
        arr.filter((c) => !c.isArchived).length <= 8,
      message: "Maximum 8 active categories allowed",
    },
  },
  aiProfile: {
    type: AIProfileSchema,
    default: () => ({}),
  },
  subscription: {
    type: SubscriptionSchema,
    default: () => ({}),
  },
  smartRecall: {
    type: SmartRecallSchema,
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
