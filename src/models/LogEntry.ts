import mongoose, { Schema, Document } from "mongoose";
import {
  LOG_SOURCES,
  SPRINT_COMPLETION_STATUSES,
  type LogSource,
  type SprintCompletionStatus,
} from "@/lib/logs";
import {
  SMART_RECALL_ELIGIBILITY_STATUSES,
  SMART_RECALL_ELIGIBILITY_VERSION,
  type SmartRecallEligibilityStatus,
} from "@/lib/smart-recall-types";

interface SmartRecallEligibility {
  status: SmartRecallEligibilityStatus;
  reason?: string | null;
  evaluatedAt?: Date | null;
  version?: number | null;
}

export interface ILogEntry extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format for easy querying
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string;
  tags?: string[];
  coachEmbedding?: number[];
  embeddingModel?: string;
  embeddingDimensions?: number;
  embeddingUpdatedAt?: Date;
  coachEmbeddingVersion?: number;
  source: LogSource;
  plannedMinutes?: number;
  actualMinutes?: number;
  startedAt?: Date;
  completedAt?: Date;
  completionStatus?: SprintCompletionStatus;
  loggedAt?: Date;
  smartRecallEligibility?: SmartRecallEligibility;
  createdAt: Date;
}

const SmartRecallEligibilitySchema = new Schema<SmartRecallEligibility>(
  {
    status: {
      type: String,
      enum: SMART_RECALL_ELIGIBILITY_STATUSES,
      default: "pending",
      required: true,
    },
    reason: { type: String, default: null, trim: true },
    evaluatedAt: { type: Date, default: null },
    version: {
      type: Number,
      default: SMART_RECALL_ELIGIBILITY_VERSION,
    },
  },
  { _id: false }
);

const LogEntrySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  hours: { type: Number, required: true },
  category: { type: String, required: true },
  rawTranscript: { type: String, required: true },
  aiSummary: { type: String },
  tags: { type: [String], default: [] },
  coachEmbedding: { type: [Number], default: undefined },
  embeddingModel: { type: String },
  embeddingDimensions: { type: Number },
  embeddingUpdatedAt: { type: Date },
  coachEmbeddingVersion: { type: Number },
  source: { type: String, enum: LOG_SOURCES, default: "manual" },
  plannedMinutes: { type: Number, min: 1 },
  actualMinutes: { type: Number, min: 1 },
  startedAt: { type: Date },
  completedAt: { type: Date },
  completionStatus: { type: String, enum: SPRINT_COMPLETION_STATUSES },
  loggedAt: { type: Date },
  smartRecallEligibility: {
    type: SmartRecallEligibilitySchema,
    default: () => ({
      status: "pending",
      reason: null,
      evaluatedAt: null,
      version: SMART_RECALL_ELIGIBILITY_VERSION,
    }),
  },
  createdAt: { type: Date, default: Date.now },
});

// Indexes for scalability: queries will usually filter by userId and date together
LogEntrySchema.index({ userId: 1, date: 1, category: 1 });
LogEntrySchema.index({ userId: 1, embeddingUpdatedAt: 1 });
LogEntrySchema.index({
  userId: 1,
  "smartRecallEligibility.status": 1,
  "smartRecallEligibility.version": 1,
  loggedAt: -1,
  createdAt: -1,
});

export default mongoose.models.LogEntry || mongoose.model<ILogEntry>("LogEntry", LogEntrySchema);
