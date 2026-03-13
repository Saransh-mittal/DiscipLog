import mongoose, { Schema, Document } from "mongoose";

export interface ILogEntry extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format for easy querying
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string;
  createdAt: Date;
}

const LogEntrySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  hours: { type: Number, required: true },
  category: { type: String, required: true, enum: ["Interview Prep", "Building", "Learning", "Shipping", "Other"] },
  rawTranscript: { type: String, required: true },
  aiSummary: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Indexes for scalability: queries will usually filter by userId and date together
LogEntrySchema.index({ userId: 1, date: 1, category: 1 });

export default mongoose.models.LogEntry || mongoose.model<ILogEntry>("LogEntry", LogEntrySchema);
