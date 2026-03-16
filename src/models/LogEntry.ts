import mongoose, { Schema, Document } from "mongoose";
import {
  LOG_CATEGORIES,
  LOG_SOURCES,
  SPRINT_COMPLETION_STATUSES,
  type LogCategory,
  type LogSource,
  type SprintCompletionStatus,
} from "@/lib/logs";

export interface ILogEntry extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format for easy querying
  hours: number;
  category: LogCategory;
  rawTranscript: string;
  aiSummary?: string;
  source: LogSource;
  plannedMinutes?: number;
  actualMinutes?: number;
  startedAt?: Date;
  completedAt?: Date;
  completionStatus?: SprintCompletionStatus;
  loggedAt?: Date;
  createdAt: Date;
}

const LogEntrySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  hours: { type: Number, required: true },
  category: { type: String, required: true, enum: LOG_CATEGORIES },
  rawTranscript: { type: String, required: true },
  aiSummary: { type: String },
  source: { type: String, enum: LOG_SOURCES, default: "manual" },
  plannedMinutes: { type: Number, min: 1 },
  actualMinutes: { type: Number, min: 1 },
  startedAt: { type: Date },
  completedAt: { type: Date },
  completionStatus: { type: String, enum: SPRINT_COMPLETION_STATUSES },
  loggedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Indexes for scalability: queries will usually filter by userId and date together
LogEntrySchema.index({ userId: 1, date: 1, category: 1 });

export default mongoose.models.LogEntry || mongoose.model<ILogEntry>("LogEntry", LogEntrySchema);
