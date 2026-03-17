import mongoose, { Schema, Document } from "mongoose";

export interface ICommitment extends Document {
  userId: mongoose.Types.ObjectId;
  text: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  status: "pending" | "completed" | "missed";
  completedAt?: Date;
  missedReason?: string;
  linkedLogId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CommitmentSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  weekStart: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "completed", "missed"],
    default: "pending",
  },
  completedAt: { type: Date },
  missedReason: { type: String },
  linkedLogId: { type: Schema.Types.ObjectId, ref: "LogEntry" },
  createdAt: { type: Date, default: Date.now },
});

CommitmentSchema.index({ userId: 1, weekStart: 1 });

export default mongoose.models.Commitment ||
  mongoose.model<ICommitment>("Commitment", CommitmentSchema);
