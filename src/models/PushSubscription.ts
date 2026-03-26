import mongoose, { Schema, Document } from "mongoose";

export interface IPushSubscription extends Document {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string;
  createdAt: Date;
  lastUsedAt: Date;
  failCount: number;
}

const PushSubscriptionKeysSchema = new Schema(
  {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  { _id: false }
);

const PushSubscriptionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { type: PushSubscriptionKeysSchema, required: true },
  userAgent: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  failCount: { type: Number, default: 0 },
});

PushSubscriptionSchema.index({ userId: 1, endpoint: 1 });

export default mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
