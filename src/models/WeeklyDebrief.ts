import mongoose, { Schema, Document } from "mongoose";

export interface ICategoryBreakdown {
  name: string;
  hours: number;
  logCount: number;
  targetHit: boolean;
  prevWeekHours: number | null;
}

export interface IWeeklyDebrief extends Document {
  userId: mongoose.Types.ObjectId;
  weekStartDate: string;
  weekEndDate: string;

  // Raw metrics
  totalHours: number;
  totalLogs: number;
  bestDay: { date: string; hours: number };
  consistencyPercent: number;
  streakDays: number;

  // Per-category breakdown
  categoryBreakdown: ICategoryBreakdown[];

  // AI-generated content
  weekTitle: string;
  coachNote: string;
  mvpCategory: string;
  hardestDay: string;
  challengeForNextWeek: string;

  // Display state
  acknowledgedAt: Date | null;

  createdAt: Date;
}

const CategoryBreakdownSchema = new Schema(
  {
    name: { type: String, required: true },
    hours: { type: Number, required: true },
    logCount: { type: Number, required: true },
    targetHit: { type: Boolean, default: false },
    prevWeekHours: { type: Number, default: null },
  },
  { _id: false }
);

const BestDaySchema = new Schema(
  {
    date: { type: String, required: true },
    hours: { type: Number, required: true },
  },
  { _id: false }
);

const WeeklyDebriefSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  weekStartDate: { type: String, required: true },
  weekEndDate: { type: String, required: true },

  totalHours: { type: Number, required: true },
  totalLogs: { type: Number, required: true },
  bestDay: { type: BestDaySchema, required: true },
  consistencyPercent: { type: Number, required: true },
  streakDays: { type: Number, default: 0 },

  categoryBreakdown: { type: [CategoryBreakdownSchema], default: [] },

  weekTitle: { type: String, required: true },
  coachNote: { type: String, required: true },
  mvpCategory: { type: String, default: "" },
  hardestDay: { type: String, default: "" },
  challengeForNextWeek: { type: String, default: "" },

  acknowledgedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

WeeklyDebriefSchema.index(
  { userId: 1, weekStartDate: 1 },
  { unique: true }
);

export default mongoose.models.WeeklyDebrief ||
  mongoose.model<IWeeklyDebrief>("WeeklyDebrief", WeeklyDebriefSchema);
