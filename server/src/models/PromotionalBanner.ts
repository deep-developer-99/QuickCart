import mongoose, { Document, Schema } from "mongoose";

export type PromotionalRedirectType = "category" | "product" | "url";

export interface IPromotionalBanner extends Document {
  title?: string;
  subtitle?: string;
  image: string;
  imagePublicId?: string;
  buttonText?: string;
  redirectType?: PromotionalRedirectType;
  redirectValue?: string;
  order: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const promotionalBannerSchema = new Schema<IPromotionalBanner>(
  {
    title: { type: String, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    image: { type: String, required: true },
    imagePublicId: String,
    buttonText: { type: String, trim: true, maxlength: 40 },
    redirectType: {
      type: String,
      enum: ["category", "product", "url"],
    },
    redirectValue: { type: String, trim: true, maxlength: 500 },
    order: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date,
  },
  { timestamps: true },
);

promotionalBannerSchema.index({ isActive: 1, order: 1, startDate: 1, endDate: 1 });

const PromotionalBanner =
  mongoose.models.PromotionalBanner ||
  mongoose.model<IPromotionalBanner>("PromotionalBanner", promotionalBannerSchema);

export default PromotionalBanner;
