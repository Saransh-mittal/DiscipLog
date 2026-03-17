import mongoose, { Schema, Document } from "mongoose";

export interface IUserCategory {
  name: string;
  dailyTargetHours: number;
  weeklyMinTarget: number;
  weeklyMaxTarget: number;
  icon: string;
  isSideCategory?: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  categories: IUserCategory[];
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
  onboardingCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
