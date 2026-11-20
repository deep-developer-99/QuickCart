import mongoose, { Document, Schema } from "mongoose";
import { customerIdentityIndexes, deletionReasons } from "../utils/customerLifecycle";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  googleId?: string;
  role: "user";
  fcmTokens: string[];
  isActive: boolean;
  activeCheckoutRequests: number;
  pendingRazorpayOrders: string[];
  deletedAt?: Date;
  deletionAttemptAt?: Date;
  confirmationAttemptAt?: Date;
  deletionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    profileImage: String,
    googleId: String,
    role: { type: String, enum: ["user"], default: "user" },
    fcmTokens: { type: [String], default: [] },
    activeCheckoutRequests: { type: Number, default: 0, select: false },
    pendingRazorpayOrders: { type: [String], default: [], select: false },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date },
    deletionAttemptAt: { type: Date, select: false },
    confirmationAttemptAt: { type: Date, select: false },
    deletionReason: { type: String, enum: deletionReasons, select: false },
  },
  { timestamps: true, autoIndex: false },
);

for (const { key, ...options } of customerIdentityIndexes) userSchema.index(key, options);

const User = mongoose.model<IUser>("User", userSchema);
export default User;
