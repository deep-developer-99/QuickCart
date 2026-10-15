import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISavedCard extends Document {
  user: Types.ObjectId;
  provider: "cashfree";
  customerId: string;
  instrumentId: string;
  cardBrand?: string;
  last4?: string;
  issuingBank?: string;
  instrumentType: "card";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const savedCardSchema = new Schema<ISavedCard>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["cashfree"], required: true, default: "cashfree" },
    customerId: { type: String, required: true },
    instrumentId: { type: String, required: true },
    cardBrand: { type: String, trim: true, maxlength: 40 },
    last4: { type: String, match: /^\d{4}$/ },
    issuingBank: { type: String, trim: true, maxlength: 100 },
    instrumentType: { type: String, enum: ["card"], default: "card", required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

savedCardSchema.index({ user: 1, instrumentId: 1 }, { unique: true });
savedCardSchema.index({ user: 1, createdAt: -1 });

// Never store PAN, CVV, expiry, or a client-supplied raw card credential here.
export default mongoose.model<ISavedCard>("SavedCard", savedCardSchema);
