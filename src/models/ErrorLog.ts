import mongoose, { Schema, Document } from "mongoose";

export interface IErrorLog extends Document {
  environment: string;
  context: string;
  errorMessage: string;
  stackTrace?: string;
  userContext?: string; // What the user was doing
  userId?: mongoose.Types.ObjectId;
  routePath?: string;
  createdAt: Date;
}

const ErrorLogSchema: Schema = new Schema({
  environment: { type: String, required: true },
  context: { type: String, required: true }, // e.g., 'Client-GlobalErrorBoundary', 'Server-SummarizeAPI'
  errorMessage: { type: String, required: true },
  stackTrace: { type: String },
  userContext: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  routePath: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.ErrorLog || mongoose.model<IErrorLog>("ErrorLog", ErrorLogSchema);
