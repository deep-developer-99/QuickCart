import mongoose, { Document, Schema } from "mongoose";

export type OfferRedirectType = "category" | "product";
export type OfferStatus = "draft" | "published";

export interface IOffer extends Document {
  title: string;
  message: string;
  redirectType: OfferRedirectType;
  redirectValue: string;
  status: OfferStatus;
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
    publishedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

offerSchema.index({ status: 1, publishedAt: -1 });

const Offer = mongoose.models.Offer || mongoose.model<IOffer>("Offer", offerSchema);

export default Offer;
