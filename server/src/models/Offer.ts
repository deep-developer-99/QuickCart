import mongoose, { Document, Schema } from "mongoose";

export type OfferRedirectType = "category" | "product";
export type OfferStatus = "draft" | "published";

export interface IOffer extends Document {
  title: string;
  message: string;
  redirectType: OfferRedirectType;
  redirectValue: string;
  status: OfferStatus;
  ownerId?: Schema.Types.ObjectId;
  ownerRole: "admin" | "vendor";
  deletedAt?: Date;
  audience: "all" | "vendor_customers";
  notificationCampaignId?: string;
  lastDispatch?: {
    stored: number;
    attempted: number;
    accepted: number;
    failed: number;
    skipped: number;
    completedAt: Date;
  };
  resendKey?: string;
  resendKeys: string[];
  dispatchHistory: Array<{ kind: "publish" | "resend"; idempotencyKey?: string; outcome: "complete" | "failed"; stored: number; attempted: number; accepted: number; failed: number; skipped: number; completedAt: Date }>;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<IOffer>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    redirectType: {
      type: String,
      enum: ["category", "product"],
      required: true,
    },
    redirectValue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, index: true },
    ownerRole: { type: String, enum: ["admin", "vendor"], default: "admin", index: true },
    deletedAt: { type: Date, default: null, index: true },
    audience: { type: String, enum: ["all", "vendor_customers"], default: "all" },
    notificationCampaignId: { type: String },
    lastDispatch: {
      stored: Number,
      attempted: Number,
      accepted: Number,
      failed: Number,
      skipped: Number,
      completedAt: Date,
    },
    resendKey: { type: String },
    resendKeys: { type: [String], default: [] },
    dispatchHistory: [{
      kind: { type: String, enum: ["publish", "resend"], required: true },
      outcome: { type: String, enum: ["complete", "failed"], default: "complete" },
      idempotencyKey: String,
      stored: { type: Number, default: 0 },
      attempted: { type: Number, default: 0 },
      accepted: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      completedAt: { type: Date, required: true },
    }],
    publishedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

offerSchema.index({ status: 1, publishedAt: -1 });
offerSchema.index({ ownerRole: 1, ownerId: 1, deletedAt: 1, createdAt: -1 });

const Offer = mongoose.models.Offer || mongoose.model<IOffer>("Offer", offerSchema);

export default Offer;
